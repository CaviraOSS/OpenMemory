import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core and React DOM
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor'
          }

          // Three.js and 3D libraries (for Graph page)
          if (id.includes('three') || id.includes('@react-three/fiber')) {
            return 'three-vendor'
          }

          // Charts library (for Analytics page)
          if (id.includes('recharts')) {
            return 'charts-vendor'
          }

          // Animation library
          if (id.includes('framer-motion')) {
            return 'animation-vendor'
          }

          // Radix UI components (split into groups)
          if (id.includes('@radix-ui/')) {
            // Dialog-related components
            if (id.includes('dialog') || id.includes('alert-dialog') || id.includes('popover')) {
              return 'radix-dialog'
            }
            // Menu-related components
            if (id.includes('menu') || id.includes('dropdown') || id.includes('context-menu')) {
              return 'radix-menu'
            }
            // Form-related components
            if (id.includes('select') || id.includes('checkbox') || id.includes('radio') ||
                id.includes('switch') || id.includes('slider') || id.includes('toggle')) {
              return 'radix-form'
            }
            // Other Radix components
            return 'radix-other'
          }

          // Form libraries
          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
            return 'form-vendor'
          }

          // Date/time libraries
          if (id.includes('date-fns') || id.includes('react-day-picker')) {
            return 'date-vendor'
          }

          // Auth and security
          if (id.includes('better-auth') || id.includes('bcryptjs')) {
            return 'auth-vendor'
          }

          // Utilities
          if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') ||
              id.includes('class-variance-authority')) {
            return 'utils-vendor'
          }

          // State management
          if (id.includes('zustand')) {
            return 'state-vendor'
          }

          // Other large node_modules
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
        },
      },
    },
    // Increase chunk size warning limit to 1MB (from 500KB)
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'esbuild',
    // Source maps for debugging (disable in production for smaller builds)
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'zod',
      'lucide-react',
    ],
  },
})
