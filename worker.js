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
      
      // کد حساب و نام دروازه شما از قبل تنظیم شده است
      const accountId = "27afaa438dc9c77044d4662c822d58d2"; 
      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/my-gateway/groq/openai/v1/chat/completions`;

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        "User-Agent": "Mozilla/5.0 (compatible; HakimVahid/1.0)",
      };

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          // مدل جدید و فعال Groq
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
