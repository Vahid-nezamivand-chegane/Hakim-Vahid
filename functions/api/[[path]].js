export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', ''); // مسیر را ساده می‌کنیم

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  // ۱. ثبت‌نام
  if (path === "/register" && request.method === "POST") {
    try {
      const { email } = await request.json();
      const existingUser = await env.HAKIM_DB.get(`user_${email}`);
      if (existingUser) return new Response(JSON.stringify({ error: "This email is already registered." }), { headers: corsHeaders });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await env.HAKIM_DB.put(`code_${email}`, code, { expirationTtl: 300 });

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Hakim Vahid <onboarding@resend.dev>",
          to: [email],
          subject: "Your Hakim Vahid Verification Code",
          html: `<strong>Your verification code is: ${code}</strong>`
        })
      });

      if (!emailResponse.ok) {
          const err = await emailResponse.text();
          return new Response(JSON.stringify({ error: "Email delivery failed: " + err }), { headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: "Code sent to your email." }), { headers: corsHeaders });
    } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders }); }
  }

  // ۲. تایید کد
  if (path === "/verify" && request.method === "POST") {
    try {
      const { email, code, age, role } = await request.json();
      const savedCode = await env.HAKIM_DB.get(`code_${email}`);
      
      if (!savedCode || savedCode !== code) {
        return new Response(JSON.stringify({ error: "Invalid or expired code." }), { headers: corsHeaders });
      }

      const userData = { email, age, role, used: 0, isPremium: false, lastDate: new Date().toDateString() };
      await env.HAKIM_DB.put(`user_${email}`, JSON.stringify(userData));
      await env.HAKIM_DB.delete(`code_${email}`);

      return new Response(JSON.stringify({ success: "Registration successful!", user: userData }), { headers: corsHeaders });
    } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders }); }
  }

  // ۳. چت
  if (path === "/chat" && request.method === "POST") {
    try {
      const { prompt, email } = await request.json();
      let user = null;
      if (email) {
          const userStr = await env.HAKIM_DB.get(`user_${email}`);
          if (userStr) user = JSON.parse(userStr);
      }

      if (!user) return new Response(JSON.stringify({ reply: "UNAUTHORIZED" }), { headers: corsHeaders });

      const today = new Date().toDateString();
      if (user.lastDate !== today) {
          user.used = 0;
          user.lastDate = today;
      }
      if (!user.isPremium && user.used >= 30) {
          return new Response(JSON.stringify({ reply: "LIMIT_REACHED", used: user.used }), { headers: corsHeaders });
      }
      if (!user.isPremium) {
          user.used += 1;
          await env.HAKIM_DB.put(`user_${email}`, JSON.stringify(user));
      }

      const accountId = "27afaa438dc9c77044d4662c822d58d2"; 
      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/my-gateway/groq/openai/v1/chat/completions`;

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "User-Agent": "Mozilla/5.0 (compatible; HakimVahid/1.0)",
        },
        body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: prompt }] })
      });

      const data = await response.json();
      let aiText = data.choices && data.choices.length > 0 ? data.choices[0].message.content : "Error.";
      return new Response(JSON.stringify({ reply: aiText, used: user.used }), { headers: corsHeaders });
    } catch (err) { return new Response(JSON.stringify({ reply: "System Error: " + err.message }), { status: 500, headers: corsHeaders }); }
  }
  
  // ۴. پرداخت
  if (path === "/create-payment" && request.method === "POST") {
      try {
        const { email } = await request.json();
        const response = await fetch("https://api.nowpayments.io/v1/invoice", {
          method: "POST",
          headers: { "x-api-key": env.NOWPAYMENTS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            price_amount: 15, price_currency: "usd", order_id: email, 
            order_description: "Hakim Vahid Premium",
            ipn_callback_url: `https://hakim-frontend.pages.dev/api/webhook`
          })
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: corsHeaders });
      } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders }); }
  }
  
  // ۵. وب‌هوک
  if (path === "/webhook" && request.method === "POST") {
      const body = await request.json();
      if (body.payment_status === 'finished') {
          const email = body.order_id;
          const userStr = await env.HAKIM_DB.get(`user_${email}`);
          if(userStr) {
              let user = JSON.parse(userStr);
              user.isPremium = true;
              await env.HAKIM_DB.put(`user_${email}`, JSON.stringify(user));
          }
      }
      return new Response("OK", { status: 200 });
  }

  return new Response("API Not Found", { status: 404 });
}
