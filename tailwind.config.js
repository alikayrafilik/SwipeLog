/** @type {import('tailwindcss').Config} */
module.exports = {
  // Update this to include the paths to all files that contain Nativewind classes
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#050814',       // deep night blue background
          navyLight: '#0D162D',  // secondary navy for cards/headers
          yellow: '#F9C80E',     // primary yellow accent
          yellowHover: '#E5B70A',// active/hover yellow state
          grayText: '#A0AEC0',   // muted gray text
        },
      },
    },
  },
  plugins: [],
}
