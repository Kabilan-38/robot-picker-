
import React from 'react';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700 my-4">
      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono flex justify-between items-center">
        <span>{language}</span>
        <button 
          onClick={() => navigator.clipboard.writeText(code.trim())}
          className="text-slate-400 hover:text-white transition-colors text-xs"
        >
          Copy
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className={`language-${language}`}>{code.trim()}</code>
      </pre>
    </div>
  );
};
