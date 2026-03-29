'use client';

import { useState, useEffect } from 'react';
import { generateScriptAction } from '../actions';

export default function ScriptTab({ sourceText, onScriptGenerated }: { sourceText: string | null; onScriptGenerated?: (script: string) => void }) {
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function generate() {
      if (!sourceText) return;
      
      setLoading(true);
      setError('');
      setScript(null);
      
      try {
        const generated = await generateScriptAction(sourceText);
        setScript(generated);
        if (generated) onScriptGenerated?.(generated);
      } catch (err: any) {
        setError(err.message || 'FAILED TO GENERATE SCRIPT');
      } finally {
        setLoading(false);
      }
    }
    
    generate();
  }, [sourceText]);

  if (!sourceText) {
    return (
      <div className="state-container">
        <p>NO DATA SOURCE PROVIDED. PLEASE SELECT AN ARTICLE FROM VIRAL_DETECT.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="state-container">
        <div className="loading-bar"></div>
        <p>SYNTHESIZING SCRIPT PAYLOAD... AWAIT SIGNAL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container error state-container">
        <h3>[ GENERATOR_ERROR ]</h3>
        <p>{error}</p>
        <button 
          className="sys-btn error-btn" 
          onClick={() => window.location.reload()}
        >
          [ RETRY_SYNTHESIS ]
        </button>
      </div>
    );
  }

  return (
    <div className="modal-box" style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
      <div className="modal-header">
        <span className="modal-title">GENERATED_SCRIPT_DATA</span>
      </div>
      <div className="modal-body">
        <div style={{ marginBottom: '24px' }}>
          <span style={{ background: '#00ffcc', color: 'var(--bg-main)', padding: '4px 12px', fontWeight: 'bold' }}>
            [ SCRIPT_SYNTHESIZED ]
          </span>
        </div>
        
        <div className="script-container" style={{ 
          whiteSpace: 'pre-wrap', 
          fontFamily: 'var(--font-mono)', 
          background: 'rgba(0,0,0,0.5)', 
          border: '1px solid var(--text-core)', 
          padding: '24px', 
          lineHeight: '1.6',
          fontSize: '1rem',
          color: 'var(--text-core)' 
        }}>
          {script}
        </div>
        
        <button 
          className="sys-btn mt-8" 
          onClick={() => {
            if (script) navigator.clipboard.writeText(script);
          }}
          style={{ borderColor: '#00ffcc', color: '#00ffcc' }}
        >
          [ COPY_TO_CLIPBOARD ]
        </button>
      </div>
    </div>
  );
}
