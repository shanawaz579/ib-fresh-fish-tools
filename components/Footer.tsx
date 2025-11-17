export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-6">
      <div className="container mx-auto text-center">
        <div>© {new Date().getFullYear()} IB Fresh Fish, Nellore</div>
        <div className="footer-links flex justify-center gap-4 mt-4">
          <a href="/privacy" className="hover:text-primary transition">Privacy Policy</a>
          <a href="/terms" className="hover:text-primary transition">Terms of Service</a>
          <a href="/contact" className="hover:text-primary transition">Contact Us</a>
        </div>
      </div>
    </footer>
  );
}
