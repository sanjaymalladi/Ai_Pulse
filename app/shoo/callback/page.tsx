'use client';
import { useShooAuth } from "@shoojs/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShooCallback() {
  useShooAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Attempt redirect back to home after callback
    const timer = setTimeout(() => {
      router.push("/");
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="terminal-container">
      <div className="bg-grid"></div>
      <div className="state-container" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '1px solid var(--brand-neon)', padding: '2rem' }}>
        <div className="loading-bar"></div>
        <p>VERIFYING IDENTITY TOKEN...</p>
      </div>
    </div>
  );
}
