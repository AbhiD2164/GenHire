import { useState } from "react";
import { googleSignIn } from "../api/auth";
import { useToast } from "../context/ToastContext";

let googleScriptPromise = null;

function loadGoogleScript() {
  const id = "google-identity-script";
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.getElementById(id);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", () => reject(new Error("Failed to load Google SDK.")));
    });
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.id = id;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google SDK."));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

export default function GoogleSignInButton({ onSuccess }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  function handleCredentialResponse(credentialResponse) {
    const id_token = credentialResponse?.credential;
    if (!id_token) return showToast("Google sign-in failed.", "error");

    googleSignIn(id_token)
      .then((data) => {
        showToast("Signed in with Google.", "success");
        if (onSuccess) onSuccess(data);
        else window.location.href = "/feed";
      })
      .catch(() => {
        showToast("Google sign-in failed.", "error");
      })
      .finally(() => setLoading(false));
  }

  async function handleClick() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return showToast("Missing Google client ID.", "error");

    setLoading(true);
    try {
      await loadGoogleScript();
      if (!window.google?.accounts?.id) {
        throw new Error("Google SDK not available.");
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.prompt();
    } catch (error) {
      showToast(error.message || "Google sign-in failed.", "error");
      setLoading(false);
    }
  }

  return (
    <button type="button" className="btn btn-danger" onClick={handleClick} disabled={loading}>
      {loading ? "Loading Google…" : "Sign in with Google"}
    </button>
  );
}
