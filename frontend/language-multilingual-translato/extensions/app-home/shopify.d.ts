import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/tools.js' {
  interface MultilingualTranslatorInput {
    /**
     * The content to translate
     */
    content: string;
    /**
     * The target language code (e.g. fr, es, de)
     */
    target_language: string;
    [k: string]: unknown;
  }

  type MultilingualTranslatorOutput = unknown;
  interface ShopifyTools {
    /**
     * Translate Shopify store content into multiple languages
     */
    register(
      name: 'multilingual_translator',
      handler: (
        input: MultilingualTranslatorInput,
      ) => MultilingualTranslatorOutput | Promise<MultilingualTranslatorOutput>,
    ): () => void;
  }

  const shopify: import('@shopify/ui-extensions/admin').WithGeneratedTools<
    import('@shopify/ui-extensions/admin.app.tools.data').Api,
    ShopifyTools
  >;
  const globalThis: { shopify: typeof shopify };
}
