import { useEffect } from "react";

export default function Settings() {
  useEffect(() => {
    window.location.href =
      "https://shopify-multilanguage-convertor-plugin.vercel.app/";
  }, []);

  return <p>Redirecting...</p>;
}