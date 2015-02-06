# esjs
Elasticsearch JavaScript client that doesn't suck. (Hopefully)

var es = new ES.Client(); // assume same domain but port 9200 for now, CORS support needed

var indexes = es.indexes(); // get a list of the indexes

var query = es.query(
  indexes.get("*"), 
  new ES.SimpleQuery("find"),
  new ES.SimpleFacet("term")
);


