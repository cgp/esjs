# esjs
Elasticsearch JavaScript client that doesn't suck. (Hopefully)

1. Fairly Lightweight (< 30k compressed)
2. In the spirit of the ES query language, but not so much as to over-complicate performing queries
3. Ability to run server side in Java 
4. Convenience parsing/formatting for return structures such as hits, histograms etc... (and the ability to extend via plugins to for tools like DS3/C3 etc..)
5. Promises
6. Some type of lazily evaluated expression language
7. plain text queries
8. YML style query building
9. intelligent in index setup
10. 

### Example Usage (in process) 
    var es = new ES.Client(); // assume same domain but port 9200 for now, CORS support needed
      
    var search = es.createSearch();
         
    search.setSize(25)
          .setFields(['a','b','c'])
          .setTimeout("5m")
          .setTrackScores(false)         
          .setPageSize(25, 3)
          .nextPage()
          .prevPage()
          .addSort("sortedField", "asc")
          .setAnalyzeWildcard(true);
      
    search.simpleQueryStringSearch("state:mi").done(function(response) {
      console.log(response.hits);
    });
    
