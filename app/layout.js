import "./globals.css";
import NavBar from "./components/NavBar";
import Providers from "./providers";

export const metadata = {
  title: "Privacy Dashboard",
  description: "Student privacy and security dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
