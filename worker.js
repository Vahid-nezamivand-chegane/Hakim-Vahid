export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

    // --- ۱. درخواست ثبت‌نام (ارسال کد) ---
    if (url.pathname === "/register" && request.method === "POST") {
      try {
        const { email } = await request.json();
        
        // چک کردن اینکه آیا کاربر از قبل وجود دارد یا نه
        const existingUser = await env.HAKIM_DB.get(`user_${email}`);
        if (existingUser) {
          return new Response(JSON.stringify({ error: "This email is already registered. Please log in or use another email." }), { headers: corsHeaders });
        }

        // ساخت کد ۶ رقمی و ذخیره در دیتابیس به مدت ۵ دقیقه
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await env.HAKIM_DB.put(`code_${email}`, code, { expirationTtl: 300 });

        // اینجا کد در کنسول کلادفلر ثبت می‌شود (برای ارسال واقعی ایمیل بعداً وصل می‌کنیم)
        console.log(`[NEW REGISTRATION] Email: ${email} | Code: ${code}`);

        return new Response(JSON.stringify({ success: "Code generated. Check your email (or Cloudflare logs for now)." }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- ۲. تایید کد و ساخت کاربر ---
    if (url.pathname === "/verify" && request.method === "POST") {
      try {
        const { email, code, age, role } = await request.json();
        
        const savedCode = await env.HAKIM_DB.get(`code_${email}`);
        if (!savedCode || savedCode !== code) {
          return new Response(JSON.stringify({ error: "Invalid or expired code." }), { headers: corsHeaders });
        }

        // ذخیره کاربر نهایی در دیتابیس
        const userData = { email, age, role, used: 0, isPremium: false, lastDate: new Date().toDateString() };
        await env.HAKIM_DB.put(`user_${email}`, JSON.stringify(userData));
        
        // پاک کردن کد تایید
        await env.HAKIM_DB.delete(`code_${email}`);

        return new Response(JSON.stringify({ success: "Registration successful!", user: userData }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- ۳. سیستم چت و مدیریت محدودیت ---
    if (request.method === "POST" && url.pathname === "/") {
      try {
        const { prompt, email } = await request.json();
        
        // بررسی وجود کاربر
        let user = null;
        if (email) {
            const userStr = await env.HAKIM_DB.get(`user_${email}`);
            if (userStr) user = JSON.parse(userStr);
        }

        if (!user) {
            return new Response(JSON.stringify({ reply: "Please register first." }), { headers: corsHeaders });
        }

        // چک کردن روز جدید (ریست کردن سقف)
        const today = new Date().toDateString();
        if (user.lastDate !== today) {
            user.used = 0;
            user.lastDate = today;
        }

        // چک کردن سقف مجاز برای کاربر رایگان
        if (!user.isPremium && user.used >= 30) {
            return new Response(JSON.stringify({ reply: "LIMIT_REACHED" }), { headers: corsHeaders });
        }

        // افزایش تعداد مصرف
        if (!user.isPremium) {
            user.used += 1;
            await env.HAKIM_DB.put(`user_${email}`, JSON.stringify(user));
        }

        // اتصال به هوش مصنوعی
        const accountId = "27afaa438dc9c77044d4662c822d58d2"; 
        const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/my-gateway/groq/openai/v1/chat/completions`;

        const response = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "User-Agent": "Mozilla/5.0 (compatible; HakimVahid/1.0)",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: prompt }]
          })
        });

        const data = await response.json();
        let aiText = data.choices && data.choices.length > 0 ? data.choices[0].message.content : "Error.";

        return new Response(JSON.stringify({ reply: aiText, used: user.used }), { headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ reply: "System Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }
    
    // --- ۴. ساخت لینک پرداخت ---
    if (url.pathname === "/create-payment" && request.method === "POST") {
        try {
          const { email } = await request.json();
          const response = await fetch("https://api.nowpayments.io/v1/invoice", {
            method: "POST",
            headers: { "x-api-key": env.NOWPAYMENTS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              price_amount: 15,
              price_currency: "usd",
              order_id: email, 
              order_description: "Hakim Vahid Premium Subscription",
              ipn_callback_url: `https://hakim-vahid.vahidmaykoltarh.workers.dev/webhook`
            })
          });
          const data = await response.json();
          return new Response(JSON.stringify(data), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }
    
    // --- ۵. وب‌هوک پرداخت (تایید VIP) ---
    if (url.pathname === "/webhook" && request.method === "POST") {
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
  }
}
