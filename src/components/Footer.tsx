import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span>© {new Date().getFullYear()} DropDaily</span>
              <div className="bg-red-600 text-white rounded px-2 py-0.5 text-xs font-medium">
                ALPHA
              </div>
            </div>
            <span className="hidden md:inline">•</span>
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              v2025.09.{String(new Date().getDate()).padStart(2, '0')}.{String(new Date().getHours()).padStart(2, '0')}:{String(new Date().getMinutes()).padStart(2, '0')}
            </span>
          </div>
          
          <div className="flex items-center flex-wrap justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
            <Link to="/topics" className="hover:text-primary transition-colors">
              Topics
            </Link>
            <Link to="/topics/technology/archive" className="hover:text-primary transition-colors">
              Archive
            </Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
        
        <div className="text-center mt-6 pt-6 border-t border-muted">
          <p className="text-xs text-muted-foreground">
            Daily curated AI and tech news, delivered every morning.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;