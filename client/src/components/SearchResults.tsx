import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { SourceList } from '@/components/SourceList';
import { Logo } from '@/components/Logo';

interface SearchResultsProps {
  query: string;
  results: any;
  isLoading: boolean;
  error?: Error;
  isFollowUp?: boolean;
  originalQuery?: string;
}

export function SearchResults({ 
  query,
  results,
  isLoading,
  error,
  isFollowUp,
  originalQuery
}: SearchResultsProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (results && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results]);

  if (error) {
    return (
      <Alert variant="destructive" className="animate-in fade-in-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error.message || 'An error occurred while searching. Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in-50">
        <div className="flex justify-center mb-8">
          <Logo animate className="w-12 h-12" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-4 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
        <div className="space-y-2">
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
        </div>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div ref={contentRef} className="space-y-6 animate-in fade-in-50">
      {/* Search Query Display */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        {isFollowUp && originalQuery && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 text-xs sm:text-sm text-muted-foreground/70">
              <span>Original search:</span>
              <span className="font-medium">"{originalQuery}"</span>
            </div>
            <div className="h-px bg-border w-full" />
          </>
        )}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 text-sm sm:text-base text-muted-foreground">
          <span>{isFollowUp ? 'Follow-up question:' : ''}</span>
          <h1 className="font-serif text-lg sm:text-3xl text-foreground">"{query}"</h1>
        </div>
      </motion.div>

      {/* Sources Section */}
      {results.sources && results.sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SourceList sources={results.sources} />
        </motion.div>
      )}

      {/* Main Content */}
      <Card className="overflow-hidden shadow-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="py-4 px-8"
        >
          <div
            className={cn(
              "prose prose-slate max-w-none",
              "dark:prose-invert",
              "prose-headings:font-bold prose-headings:mb-4",
              "prose-h2:text-2xl prose-h2:mt-8 prose-h2:border-b prose-h2:pb-2 prose-h2:border-border",
              "prose-h3:text-xl prose-h3:mt-6",
              "prose-p:text-base prose-p:leading-7 prose-p:my-4",
              "prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6",
              "prose-li:my-2 prose-li:marker:text-muted-foreground",
              "prose-strong:font-semibold",
              "prose-a:text-primary prose-a:no-underline hover:prose-a:text-primary/80",
              "[&_.reference-link]:text-primary [&_.reference-link]:no-underline [&_.reference-link]:font-medium [&_.reference-link]:hover:text-primary/80 [&_.reference-link]:cursor-pointer [&_.reference-link]:ml-0.5 [&_.reference-link]:text-sm [&_.reference-link]:bg-primary/5 [&_.reference-link]:px-1.5 [&_.reference-link]:py-0.5 [&_.reference-link]:rounded-md [&_.reference-link]:transition-colors",
              "[&_.reference-container]:inline-flex [&_.reference-container]:items-center [&_.reference-container]:relative [&_.reference-container]:z-10",
              "[&_.reference-tooltip]:z-50 [&_.reference-tooltip]:bg-background dark:[&_.reference-tooltip]:bg-gray-900 [&_.reference-tooltip]:border-border dark:[&_.reference-tooltip]:border-gray-700",
              "[&_.reference-title]:text-foreground dark:[&_.reference-title]:text-gray-100",
              "[&_.reference-snippet]:text-muted-foreground dark:[&_.reference-snippet]:text-gray-400",
              "[&_.reference-url]:text-primary dark:[&_.reference-url]:text-blue-400 [&_.reference-url]:border-border dark:[&_.reference-url]:border-gray-700",
              "[&_.reference-tooltip::before]:border-top-color-border dark:[&_.reference-tooltip::before]:border-top-color-gray-700",
              "[&_.reference-tooltip::after]:border-top-color-background dark:[&_.reference-tooltip::after]:border-top-color-gray-900",
              "dark:[&_.reference-link]:text-blue-400 dark:[&_.reference-link]:bg-blue-400/10 dark:hover:[&_.reference-link]:bg-blue-400/20"
            )}
            dangerouslySetInnerHTML={{ 
              __html: results.summary
            }}
          />
        </motion.div>
      </Card>
    </div>
  );
}