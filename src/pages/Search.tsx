import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [currentQuery, setCurrentQuery] = useState(query);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentQuery.trim()) {
      setSearchParams({ q: currentQuery.trim() });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <SearchIcon className="w-8 h-8" />
            Advanced Search
          </h1>
          <p className="text-muted-foreground">
            Search through thousands of AI & ML articles, videos, and resources
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4 max-w-2xl mx-auto">
            <Input
              type="text"
              placeholder="Search for articles, videos, topics..."
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <SearchIcon className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </form>

        {/* Results */}
        {query ? (
          <div className="bg-muted/30 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Search Results for "{query}"
            </h2>
            <p className="text-muted-foreground mb-4">
              Search functionality is being implemented
            </p>
            <Button variant="outline" asChild>
              <Link to="/feed">Browse All Content</Link>
            </Button>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-2xl p-8 text-center">
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Start your search
            </h2>
            <p className="text-muted-foreground mb-4">
              Enter keywords to find relevant content
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setCurrentQuery("ai");
                  setSearchParams({ q: "ai" });
                }}
              >
                AI Articles
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setCurrentQuery("machine learning");
                  setSearchParams({ q: "machine learning" });
                }}
              >
                Machine Learning
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setCurrentQuery("neural networks");
                  setSearchParams({ q: "neural networks" });
                }}
              >
                Neural Networks
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;