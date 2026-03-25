import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const port = Number(env.VITE_PORT || 5175);
  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8789';

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['lucide-react'],
    },

    // Si tu veux exposer une constante, ok, mais évite /api ici
    define: {
      __VITE_BACKEND_URL__: JSON.stringify(backend),
    },

    server: {
      port,
      host: true, // pratique pour accéder depuis le LAN (IPv4 et IPv6)
      allowedHosts: true,
      hmr: {
        // clientPort: port, // Laissez Vite déterminer le port (443 en https)
      },
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
