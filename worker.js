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
      
      // ⚠️ اینجا آدرس دروازه (Gateway) خودت را قرار بده
      // به جای YOUR_ACCOUNT_ID، کد حساب خودت را بگذار
      const gatewayUrl = "https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/hakim-gateway/groq/openai/v1/chat/completions";

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "User-Agent": "Mozilla/5.0 (compatible; HakimVahid/1.0)", // جلوگیری از بلاک شدن توسط WAF
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b", // مدل جدید و مجاز
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
          return new Response(JSON.stringify({ reply: "Groq Error: " + data.error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
      }

      let aiText = "No response from AI.";
      if(data.choices && data.choices.length > 0) {
        aiText = data.choices[0].message.content;
      }

      return new Response(JSON.stringify({ reply: aiText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
}
