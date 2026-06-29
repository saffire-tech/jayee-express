import DOMPurify from "dompurify";

// Sanitize admin-authored HTML before rendering. Allow common formatting,
// links, lists, and inline images. Block scripts, iframes, event handlers.
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "code", "pre",
      "ul", "ol", "li", "blockquote",
      "h1", "h2", "h3", "h4",
      "a", "img", "span", "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i,
    ADD_ATTR: ["target"],
  });
}
