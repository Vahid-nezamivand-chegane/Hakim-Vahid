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
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      
      // اگر Groq خطایی داده باشد، دقیقاً همان خطا را به ما نشان بده
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
