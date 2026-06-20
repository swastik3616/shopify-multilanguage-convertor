import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/AppHome.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.tools.data').Api;
  const globalThis: { shopify: typeof shopify };
}
