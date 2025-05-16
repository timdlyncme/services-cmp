import React from 'react';

// Simple markdown parser for chat messages
export function parseMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split the text into lines
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let codeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  let listItems: string[] = [];
  let inParagraph = false;
  let paragraphContent = '';

  const flushParagraph = () => {
    if (paragraphContent) {
      // Process inline formatting
      let formatted = paragraphContent;
      
      // Bold: **text** or __text__
      formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
      
      // Italic: *text* or _text_
      formatted = formatted.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
      
      // Code: `text`
      formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
      
      // Links: [text](url)
      formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');

      result.push(<p key={`p-${result.length}`} dangerouslySetInnerHTML={{ __html: formatted }} />);
      paragraphContent = '';
      inParagraph = false;
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`ul-${result.length}`} className="list-disc pl-6 my-2">
          {listItems.map((item, i) => {
            // Process inline formatting for list items
            let formatted = item;
            formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
            formatted = formatted.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
            formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
            formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');
            
            return <li key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
          })}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (codeBlock) {
        // End of code block
        result.push(
          <pre key={`code-${result.length}`} className="bg-gray-800 text-gray-100 p-3 rounded my-2 overflow-x-auto">
            <code className={codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}>
              {codeBlockContent}
            </code>
          </pre>
        );
        codeBlock = false;
        codeBlockContent = '';
        codeBlockLanguage = '';
      } else {
        // Start of code block
        flushParagraph();
        flushList();
        codeBlock = true;
        codeBlockLanguage = line.trim().slice(3).trim();
      }
      continue;
    }

    if (codeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      result.push(<h1 key={`h1-${result.length}`} className="text-xl font-bold my-2">{line.slice(2)}</h1>);
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      result.push(<h2 key={`h2-${result.length}`} className="text-lg font-bold my-2">{line.slice(3)}</h2>);
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      result.push(<h3 key={`h3-${result.length}`} className="text-md font-bold my-2">{line.slice(4)}</h3>);
      continue;
    }

    // List items
    if (line.trim().match(/^[*-] /)) {
      flushParagraph();
      listItems.push(line.trim().slice(2));
      continue;
    }

    // Numbered list
    if (line.trim().match(/^\d+\. /)) {
      flushParagraph();
      listItems.push(line.trim().replace(/^\d+\. /, ''));
      continue;
    }

    // If we reach here and have list items, flush them as we're no longer in a list
    flushList();

    // Empty line
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular paragraph text
    if (!inParagraph) {
      inParagraph = true;
      paragraphContent = line;
    } else {
      paragraphContent += ' ' + line;
    }
  }

  // Flush any remaining content
  flushParagraph();
  flushList();

  // Handle any remaining code block
  if (codeBlock && codeBlockContent) {
    result.push(
      <pre key={`code-${result.length}`} className="bg-gray-800 text-gray-100 p-3 rounded my-2 overflow-x-auto">
        <code className={codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}>
          {codeBlockContent}
        </code>
      </pre>
    );
  }

  return result;
}

