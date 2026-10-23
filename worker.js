export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // ۱. مسیر ساخت لینک پرداخت (Checkout)
    if (url.pathname === "/create-payment" && request.method === "POST") {
      try {
        const response = await fetch("https://api.nowpayments.io/v1/invoice", {
          method: "POST",
          headers: {
            "x-api-key": env.NOWPAYMENTS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            price_amount: 15, // قیمت اشتراک ۱۵ دلار
            price_currency: "usd",
            order_id: "user_" + Date.now(),
            order_description: "Hakim Vahid Premium Subscription",
            ipn_callback_url: `https://hakim-vahid.vahidmaykoltarh.workers.dev/webhook`
          })
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ۲. مسیر دریافت تاییدیه پرداخت (Webhook)
    if (url.pathname === "/webhook" && request.method === "POST") {
      // در اینجا سیستم به صورت خودکار پیام NOWPayments را می‌گیرد
      // (برای امنیت کامل، باید امضای دیجیتال را چک کنیم، فعلاً پیام موفقیت برمی‌گردانیم)
      return new Response("OK", { status: 200 });
    }

    // ۳. مسیر اصلی هوش مصنوعی (چت)
    if (request.method === "POST") {
      try {
        const { prompt } = await request.json();
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
        
        if (data.error) {
            return new Response(JSON.stringify({ reply: "API Error: " + JSON.stringify(data.error) }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (!data.choices || data.choices.length === 0) {
            return new Response(JSON.stringify({ reply: "Unknown Response: " + JSON.stringify(data) }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: "System Error: " + error.message }), { status: 500, headers: corsHeaders });
      }
    }
  }
}
