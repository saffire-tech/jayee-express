import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  /** Path-only or absolute. Defaults to the current pathname. */
  canonicalPath?: string;
  image?: string;
  type?: "website" | "article" | "product";
  /** Structured data object (or array of objects). Will be JSON.stringified. */
  jsonLd?: object | object[];
  noindex?: boolean;
}

const SITE_URL = "https://jayeeexpress.com";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/pUKptGpdl1OV5MDWb5P8hRjCVWI2/social-images/social-1781157791512-ChatGPT_Image_May_6,_2026,_03_29_35_PM.webp";

export const SEO = ({
  title,
  description,
  canonicalPath,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
  noindex = false,
}: SEOProps) => {
  const path =
    canonicalPath ??
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Jayee Express" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SEO;
