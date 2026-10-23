export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const { prompt } = await request.json();
      
      // 🚨 مهم: در خط زیر، YOUR_ACCOUNT_ID را با کد حساب کلادفلر خودت جایگزین کن
      const accountId = "YOUR_ACCOUNT_ID"; 
      
      // آدرس دروازه امن کلادفلر برای عبور از فیلترهای Groq
      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/hakim-gateway/groq/openai/v1/chat/completions`;

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "User-Agent": "Mozilla/5.0 (compatible; HakimVahid/1.0)",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", // مدل استاندارد و پایدار Groq
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      
      // سیستم خطایابی دقیق: اگر پاسخی غیر از حالت استاندارد بود، دقیقاً بگو چه خبر است
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

      // اگر همه چیز درست بود، متن جواب را برمی‌گردانیم
      const aiText = data.choices[0].message.content;

      return new Response(JSON.stringify({ reply: aiText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "System Error: " + error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
}
