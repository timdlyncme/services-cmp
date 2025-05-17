import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Parse markdown content to HTML with sanitization
 */
export const parseMarkdown = (content: string): string => {
  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
  });

  // Parse markdown to HTML
  const html = marked(content);

  // Sanitize HTML to prevent XSS
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 
      'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 
      'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
  });

  return sanitizedHtml;
};

