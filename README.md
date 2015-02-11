# esjs
Elasticsearch JavaScript client that doesn't suck. (Hopefully)

1. Lightweight (< 15k compressed)
2. In the spirit of the ES query language, but not so much as to over-complicate performing queries
3. Ability to run server side in Java 
4. Convenience parsing/formatting for return structures such as hits, histograms etc... (and the ability to extend via plugins to for tools like DS3/C3 etc..)
5. Ability to return all generated queries, run raw queries
6. Promises
 
### Example Usage (in process) 
    var es = new ES.Client(); // assume same domain but port 9200 for now, CORS support needed
        
    es.getTypes().done(function(types){
        .. do something with types 
    }); // get a lits of the types across all indexes       
    
    var query = es.query();
    query.addIndexes("*");
    query.addSimpleQuery("elephants");      
    query.addFacet("facetname", "term");
    query.addFilter("term", vals);
    query.setPageSize(30)
    query.setPage(2); // zero based
    query.exec().done(function(result) {
      for(var i=0;i<result.hits.length;i++) {
        console.log(result.hits._id);
      }
      console.log(result.hits.totalPages);
      console.log(result.facets['facetname']['termvalue'])              
    });

    // elsewhere    
    query.nextPage();
    query.exec(resultHandler).done(function(results) {
      // .. do soemthing with next page of results
    });;
    

