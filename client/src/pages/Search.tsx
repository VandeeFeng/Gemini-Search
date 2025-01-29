import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SearchInput } from '@/components/SearchInput';
import { SearchResults } from '@/components/SearchResults';
import { FollowUpInput } from '@/components/FollowUpInput';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SourceList } from '@/components/SourceList';

export function Search() {
  const [location, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [originalQuery, setOriginalQuery] = useState<string | null>(null);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState<string | null>(null);
  
  // 添加历史记录状态
  const [searchHistory, setSearchHistory] = useState<Array<{
    query: string;
    results: any;
    isFollowUp: boolean;
    originalQuery?: string;
  }>>([]);
  
  // Extract query from URL, handling both initial load and subsequent navigation
  const getQueryFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('q') || '';
  };
  
  const [searchQuery, setSearchQuery] = useState(getQueryFromUrl);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery, refetchCounter],
    queryFn: async () => {
      if (!searchQuery) return null;
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      const result = await response.json();
      console.log('Search API Response:', JSON.stringify(result, null, 2));
      if (result.sessionId) {
        setSessionId(result.sessionId);
        setCurrentResults(result);
        if (!originalQuery) {
          setOriginalQuery(searchQuery);
        }
        setIsFollowUp(false);
        // 新搜索时重置历史
        setSearchHistory([{
          query: searchQuery,
          results: result,
          isFollowUp: false
        }]);
      }
      return result;
    },
    enabled: !!searchQuery,
  });

  // Follow-up mutation
  const followUpMutation = useMutation({
    mutationFn: async (followUpQuery: string) => {
      if (!sessionId) {
        const response = await fetch(`/api/search?q=${encodeURIComponent(followUpQuery)}`);
        if (!response.ok) throw new Error('Search failed');
        const result = await response.json();
        console.log('New Search API Response:', JSON.stringify(result, null, 2));
        if (result.sessionId) {
          setSessionId(result.sessionId);
          setOriginalQuery(searchQuery);
          setIsFollowUp(false);
          // 新搜索时重置历史
          setSearchHistory([{
            query: followUpQuery,
            results: result,
            isFollowUp: false
          }]);
        }
        return result;
      }

      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          query: followUpQuery,
        }),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          const newResponse = await fetch(`/api/search?q=${encodeURIComponent(followUpQuery)}`);
          if (!newResponse.ok) throw new Error('Search failed');
          const result = await newResponse.json();
          console.log('Fallback Search API Response:', JSON.stringify(result, null, 2));
          if (result.sessionId) {
            setSessionId(result.sessionId);
            setOriginalQuery(searchQuery);
            setIsFollowUp(false);
            // 新搜索时重置历史
            setSearchHistory([{
              query: followUpQuery,
              results: result,
              isFollowUp: false
            }]);
          }
          return result;
        }
        throw new Error('Follow-up failed');
      }
      
      const result = await response.json();
      console.log('Follow-up API Response:', JSON.stringify(result, null, 2));
      return result;
    },
    onSuccess: (result) => {
      setCurrentResults(result);
      setIsFollowUp(true);
      // 追加到历史记录
      setSearchHistory(prev => [...prev, {
        query: followUpQuery!,
        results: result,
        isFollowUp: true,
        originalQuery: originalQuery || ''
      }]);
    },
  });

  const handleSearch = async (newQuery: string) => {
    if (newQuery === searchQuery) {
      setRefetchCounter(c => c + 1);
    } else {
      setSessionId(null); // Clear session on new search
      setOriginalQuery(null); // Clear original query
      setIsFollowUp(false); // Reset follow-up state
      setSearchQuery(newQuery);
      // 新搜索时重置历史记录
      setSearchHistory([]);
    }
    // Update URL without triggering a page reload
    const newUrl = `/search?q=${encodeURIComponent(newQuery)}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleFollowUp = async (newFollowUpQuery: string) => {
    setFollowUpQuery(newFollowUpQuery);
    await followUpMutation.mutateAsync(newFollowUpQuery);
  };

  // Automatically start search when component mounts or URL changes
  useEffect(() => {
    const query = getQueryFromUrl();
    if (query && query !== searchQuery) {
      setSessionId(null); // Clear session on URL change
      setOriginalQuery(null); // Clear original query
      setIsFollowUp(false); // Reset follow-up state
      setSearchQuery(query);
      // URL 变化时重置历史记录
      setSearchHistory([]);
    }
  }, [location]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-background"
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-6xl mx-auto p-4"
      >
        <motion.div 
          className="flex items-center gap-4 mb-6"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            className="hidden sm:flex"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="w-full max-w-2xl">
            <SearchInput
              onSearch={handleSearch}
              initialValue={searchQuery}
              isLoading={isLoading}
              autoFocus={false}
              large={false}
            />
          </div>
        </motion.div>

        {/* 显示所有结果 */}
        <div className="space-y-8">
          {searchHistory.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SearchResults
                query={item.query}
                results={item.results}
                isLoading={false}
                error={undefined}
                isFollowUp={item.isFollowUp}
                originalQuery={item.originalQuery}
              />
            </motion.div>
          ))}

          {/* 显示加载状态 */}
          {(isLoading || followUpMutation.isPending) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SearchResults
                query={followUpQuery || searchQuery}
                results={null}
                isLoading={true}
                error={(error || followUpMutation.error) || undefined}
                isFollowUp={isFollowUp}
                originalQuery={originalQuery || ''}
              />
            </motion.div>
          )}
        </div>

        {/* Follow-up 输入框 */}
        {currentResults && !isLoading && !followUpMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="sticky bottom-4 max-w-2xl mx-auto bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10"
          >
            <FollowUpInput
              onSubmit={handleFollowUp}
              isLoading={followUpMutation.isPending}
            />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}