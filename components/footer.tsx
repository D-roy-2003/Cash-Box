import Link from "next/link";
import { Facebook, Instagram, Linkedin, X } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full py-4 px-4 bg-gray-800 text-white">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-2">Follow Us</h3>
            <div className="flex space-x-4">
              <Link
                href="https://www.facebook.com/subhobrata.maity.96/"
                target="_blank"
                className="text-gray-300 hover:text-white"
              >
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link
                href="https://www.instagram.com/subhox_maity/"
                target="_blank"
                className="text-gray-300 hover:text-white"
              >
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Link>
              <Link
                href="https://x.com/maity6449"
                target="_blank"
                className="text-gray-300 hover:text-white"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">X</span>
              </Link>
              <Link
                href="https://www.linkedin.com/in/subhobrata-maity-260b16259/"
                target="_blank"
                className="text-gray-300 hover:text-white"
              >
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-sm font-medium mb-2">Developer Team</h3>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-300">
              <Link
                href="https://www.linkedin.com/in/subhobrata-maity-260b16259/"
                target="_blank"
                className="text-gray-300 hover:text-white hover:underline"
              >
                Subhobrata Maity
              </Link>
              <span>•</span>
              <Link
                href="https://www.linkedin.com/in/prasenjit-datta/"
                target="_blank"
                className="text-gray-300 hover:text-white hover:underline"
              >
                Prasenjit Datta
              </Link>
              <span>•</span>
              <Link
                href="https://www.linkedin.com/in/debangshu-roy-5531b8272/"
                target="_blank"
                className="text-gray-300 hover:text-white hover:underline"
              >
                Debangshu Roy
              </Link>
              <span>•</span>
              <Link
                href="https://www.linkedin.com/in/gaurav-majumder-2484a1356/"
                target="_blank"
                className="text-gray-300 hover:text-white hover:underline"
              >
                Gourav Majumder
              </Link>
              <span>•</span>
              <Link
                href="https://www.linkedin.com/in/prem-ghosh-181414255"
                target="_blank"
                className="text-gray-300 hover:text-white hover:underline"
              >
                Prem Ghosh
              </Link>
            </div>
          </div>

          <div className="text-xs text-gray-400 mt-2">
            &copy; {new Date().getFullYear()} Cash-Box. All Rights Reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
