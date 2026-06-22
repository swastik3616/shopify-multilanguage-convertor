export default () => {
  shopify.tools.register("multilingual_translator", async ({ content, target_language }) => {
    const res = await fetch("https://shopify-multilanguage-convertor.onrender.com/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, target_language }),
    });
    return res.json();
  });
};