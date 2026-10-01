import Image from "next/image";

export function SurlsLogo() {
  return (
    <span className="surls-logo">
      <Image className="surls-logo-day" src="/brand/surls-s-url-links.svg" alt="Surls" width={1176} height={433} unoptimized />
      <Image className="surls-logo-night" src="/brand/surls-s-url-links-dark.svg" alt="Surls" width={1176} height={433} unoptimized />
    </span>
  );
}
