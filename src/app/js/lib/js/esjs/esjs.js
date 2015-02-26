define([
	"jquery",
  "jsonpath"
], function ($, JSONPath) {
  var Utils = {
   "isUndefinedOrNull": function(val) {
                          return (typeof val == "undefined") || (val == null);
   },
   "array_move": function(arr,old_index, new_index) {
                    if (new_index >= arr.length) {
                        var k = new_index - arr.length;
                        while ((k--) + 1) {
                            arr.push(undefined);
                        }
                    }
                    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
                    return arr; // for testing purposes
   },
   "array_remove": function(arr, from, to) {
                    var rest = arr.slice((to || from) + 1 || arr.length);
                    arr.length = from < 0 ? arr.length + from : from;
                    return arr.push.apply(this, rest);
   },
   "serialize": function(o) {
                  var queryString = "",
                      delim = "",
                      props = Object.keys(o);

                  for(var x=0;x<props.length;x++) {
                    queryString += delim + props[x] + "=" + encodeURIComponent( o[props[x]] );
                    delim = "&";
                  }
                  return queryString;
   },
   "getVal": function(val, logstuff) {
        if (typeof val == "function") {
          return val();
        }
        if (Array.isArray(val)) {
          var result = [];
          for(var x=0;x<val.length;x++) {
            result.push(Utils.getVal(val[x]));
          }
          return result;
        }
        if ((typeof val == "object") && (val.getBody)) {
          return val.getBody(logstuff);
        }
        return val;
   },
   "getQueryDSLStruct": function(queryDSLStruct, logstuff) {
      // ends up getting used by Search,Query,Filter, so Utils is the most logical location
      //console.log(queryDSLStruct, typeof queryDSLStruct);
      if (typeof logstuff != "undefined") {
        //console.log("in", queryDSLStruct);
      }
      var keys = Object.keys(queryDSLStruct);
      if (keys.length == 0) {
        return null;
      }
      var body = {};
      for(var x=0;x<keys.length;x++) {
        body[keys[x]] = Utils.getVal(queryDSLStruct[keys[x]], logstuff);
      }
      if (typeof logstuff != "undefined") {
        //console.log("result", body, JSON.stringify(body));
      }
      return body;
    }
  };

  var ES = {};
  ES.Node = function(parent, getBodyFunc, subqueryFields, subqueryArrayFields) {
    this.up = function() { return parent; }
    this.getBody = getBodyFunc;
  }
  
  /**
  Provides the base Widget class...

  @module widget
  */
  ES.Client = function(cfg) {
    if (typeof cfg === "undefined") cfg = {};
    this.host = Utils.isUndefinedOrNull(cfg.host) ? "127.0.0.1" : cfg.host;
    this.port = Utils.isUndefinedOrNull(cfg.port) ? "9200" : cfg.port;
    this.context = Utils.isUndefinedOrNull(cfg.context) ? "/" : cfg.context;
    this.baseurl = "http://"+this.host+":"+this.port+this.context;
    this.cache = {};
    this.ajax = function(url, data, cacheName, opts) {
      if (!((url.indexOf("http://") == 0) || (url.indexOf("https://") == 0) || (url.indexOf("//") == 0))) {
        url = this.baseurl + url;
      }
      var ajaxOpts = {
        url: url,
        crossDomain: true
      };
      $.extend(ajaxOpts, opts);
      if (!Utils.isUndefinedOrNull(data)) {
        if (typeof data == "object") {
          //console.log(data);
          data = JSON.stringify(data);
        }
        ajaxOpts.data = data;
        if (ajaxOpts.type == "undefined"){
          ajaxOpts.type = "POST";
        }
      }

      var client = this;
      if (Utils.isUndefinedOrNull(cacheName)) {
        return $.ajax(ajaxOpts).done(function(response) {
          client.cache[cacheName] = response;
        });
      } else {
        return $.ajax(ajaxOpts);
      }
    }
    this.indices = new ES.Indices(this);
  }

  /**

    ES.Client handles setting up all the root requests for elasticsearch.

    http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/index.html


    @class ES.Client

   */
  $.extend(ES.Client.prototype, {
    "version": function(opts) {
      return this.ajax("", null, "version", opts);
    },
    "nodesStats": function(opts) {
      return this.ajax("_nodes/stats?all=true", null, "stats", opts);
    },
    "nodes": function(opts) {
      return this.ajax("_nodes", null, "nodes", opts);
    },
    "status": function(opts) {
      return this.ajax("_status", null, "status", opts);
    },
    "cluster": function(opts) {
      return this.ajax("_cluster/state", null, "cluster", opts);
    },

    /**
      Creates a set of records.

      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/docs-bulk.html

      A basic call would look like:

      es.docBulk([{name: "Carson, John"},{name: "McMahon, Ed"},{name: "Correct, Sir"}], {_index: "names", _type: "name"});

      Would load the data. Alternatively, if you want more fine grain control, specify the first argument as
      a string and the data will be posted directly to the server.

      @method docBulk
      @param {String|Array} records records in the format expected by an elasticsearch server, or a set of objects that will be serialized into an array
      @param {Object} opts Additional information to post to the server such as the index. Will be utilized if you specify a set of JSON objects in an array.
      @return {String} response The response from the server.
     */
    "docBulk": function(records, opts) {
      var ajaxOpts = {
        type: "POST",
        contentType:"application/json; charset=utf-8"
      };
      var t = "";
      if(Array.isArray(records)) {
        for(var x=0;x<records.length;x++) {
          t += '{ "index" : {_index:"'+opts._index+'",_type:"'+opts._type+"\"}}\n";
          t += JSON.stringify(records[x])+"\n";
        }
      }
      return this.ajax(opts._index+"/_bulk", t, null, ajaxOpts);
    },
    "search": function(query, indicies, type, opts) {
      var search = new ES.Search(this, indices, type);
      search.searchUrlVals = opts;
      search.search(query);
    },
    "createSearch": function(indices, type) {
      return new ES.Search(this, indices, type);
    }
  });

  //http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/indices.html
  ES.Indices = function(client) {
    this.client = client;
  }

  $.extend(ES.Indices.prototype, {
    "stats": function(indices, stats) {
      if (Utils.isUndefinedOrNull(indices)) {
        indices = "";
      }
      if (Utils.isUndefinedOrNull(stats)) {
        stats = "_stats";
      }
      if (Array.isArray(indices)) {
        indices = indices.join(",");
      }
      if (Array.isArray(stats)) {
        stats = "_stats/" + stats.join(",");
      }
      if (stats.indexOf("_stats") != 0) {
        stats = "_stats/" + stats;
      }
      var url = indices ? indices + "/" + stats : stats;
      return this.client.ajax(url, null, null, null);
    },
    /**
     Creates an index with basic options or a mapping.

     http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-create-index.html

     @method create
     @param {String} indexName Name of the index
     @param {integer} shardCount number of shards, defaults to 1 if undefined, if null, defaults to whatever server is configured to
     @param {integer} replicaCount number of replicas, defaults to 0 if undefined, if null, defaults to whatever server is configured to.
     @param {Object} opts extra options, formatted as specified in the elasticsearch documentation
     @return {String} response The response from the server.
    */
    "create": function(indexName, shardCount, replicaCount, opts) {
      var ajaxOpts = {
        type: "PUT"
      };
      if ((typeof opts == "undefined") || (typeof opts != "object")) {
        opts = {};
      }
      if (typeof shardCount == "undefined") {shardCount = 1};
      if (typeof replicaCount == "undefined") {replicaCount = 0};
      if (typeof opts.settings == "undefined") {
        opts.settings = {};
      }
      opts.settings.number_of_shards = shardCount;
      opts.settings.number_of_replicas = replicaCount;
      //console.log(this.client);
      return this.client.ajax(indexName+"/", opts, null, ajaxOpts);
    },

    /**
      Tests whether an index exists.

      See, it would be tempting to use async here if I didn't understand the promise of promises:
      https://gist.github.com/domenic/3889970

      Great article, now I need to rewrite the docs to reflect this better.

      http://eng.wealthfront.com/2012/12/jquerydeferred-is-most-important-client.html
      http://www.html5rocks.com/en/tutorials/es6/promises/

      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-exists.html

     @method exists
     @param {String} indexName Name of the index
     @return {boolean} response Interpreted response from server.
    */
    "exists": function(indexName) {
      var ajaxOpts = {
        type: "HEAD"
      };
      return this.client.ajax(indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {
        return new jQuery.Deferred().resolve(true);
      }, function() {
        return new jQuery.Deferred().resolve(false);
      });
    },

    /**
      Removes an index. Delete is a reserved keyword in JavaScript :(

      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-delete-index.html

      @method remove
      @param {String} indexName
      @return {boolean} response The response from the server. (true if successful)
    */
    "remove": function(indexName) {
      var ajaxOpts = {
        type: "DELETE"
      };
      return this.client.ajax(indexName+"/", null, null, ajaxOpts).then(function(response, text, xhr) {
        return new jQuery.Deferred().resolve(true);
      }, function() {
        return new jQuery.Deferred().resolve(false);
      });
    }
  });


  // http://okfnlabs.org/blog/2013/07/01/elasticsearch-query-tutorial.html#match-all--find-everything
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-body.html
  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search.html
  ES.Search = function(client, indices, type) {
    if (Utils.isUndefinedOrNull(indices)) {
      indices = "_all";
    } else if (Array.isArray(indices)) {
      indices = indices.join(",");
    }

    if (Utils.isUndefinedOrNull(type)) {
      type = "";
    } else {
      type = "/" + type;
    }

    this.indices = indices;
    this.type = type;
    this.client = client;
    this.post_filter = new ES.Filter(this);
    this.sorts = [];
    this.searchUrlVals = {};
    this.aggs = []; // we're going to implement facets this way of course
    this.query = new ES.Query(this);
  }

  $.extend(ES.Search.prototype, {
    "__setField": function(field, val) {
      if (Utils.isUndefinedOrNull(val) && (typeof this.searchUrlVals[field] != "undefined")) {
        delete this.searchUrlVals[field];
        return this;
      }

      this.searchUrlVals[field] = Array.isArray(val) ? val.join(",") : val;
      return this;
    },
    "setDefaultField": function(defaultField) {
      return this.__setField("df", defaultField);
    },
    "setAnalyzer": function(analyzer) {
      return this.__setField("analyzer", analyzer);
    },
    "setDefaultOperator": function(defaultOperator) {
      return this.__setField("default_operator", defaultOperator);
    },
    "setExplain": function(explain) {
      return this.__setField("explain", explain);
    },
    "setSource": function(_source) {
      return this.__setField("_source", _source);
    },
    "setFields": function(fields) {
      return this.__setField("fields", fields);
    },
    "setTrackScores": function(trackScores) {
      return this.__setField("track_scores", trackScores);
    },
    "setTimeout": function(timeout) {
      return this.__setField("timeout", timeout);
    },
    "setTerminateAfter": function(terminateAfter) {
      return this.__setField("terminate_after", terminateAfter);
    },
    "setFrom": function(from) {
      return this.__setField("from", from);
    },
    "setSize": function(size) {
      return this.__setField("size", size);
    },
    "setSearchType": function(searchType) {
      return this.__setField("search_type", searchType);
    },
    "setLowercaseExpandedTerms": function(lowercaseExpandedTerms) {
      return this.__setField("lowercase_expanded_terms", lowercaseExpandedTerms);
    },
    "setAnalyzeWildcard": function(analyzeWildcard) {
      return this.__setField("analyze_wildcard", analyzeWildcard);
    },
    "setPageSize": function(pageSize, page) {
      if (Utils.isUndefinedOrNull(pageSize)) {
        if (this.pageSize) {
          delete this.pageSize;
        }
      } else {
        this.pageSize = pageSize;
        this.setPage(page);
      }
      return this;
    },
    "nextPage": function() {
      if (Utils.isUndefinedOrNull(this.page)) {
        return this.setPage(1);
      }
      return this.setPage(this.page+1);
    },
    "prevPage": function() {
      if (Utils.isUndefinedOrNull(this.page)) {
        return this.setPage();
      }
      return this.setPage(this.page-1);
    },
    "setPage": function(page) {
      if (Utils.isUndefinedOrNull(this.pageSize)) {
        return this;
      }
      if (Utils.isUndefinedOrNull(page)) {
        page = 0;
      }
      if (this.page < 0) {
        page = 0;
      }
      this.page = page;
      return this.__setField("from", this.pageSize * page);
    },
    "setMaxPage": function(maxPage) {
      if (Utils.isUndefinedOrNull(maxPage)) {
        if (this.pageSize) {
          delete this.maxPage;
        }
        return this;
      }
      this.maxPage = maxPage;
      return this;
    },
    "findSort": function(field) {
      for(var x=0;x<this.sorts.size;x++) {
        if (field === this.sorts[x].field) {
          return x;
        }
      }
      return -1;
    },
    "moveSortTo": function(field, newIndex) {
      var idx = this.findSort(field);
      if (idx == -1) {
          return this;
      }
      Utils.array_move(this.sorts, idx, newIndex);
      return this;
    },
    "addSort": function(field, order, mode, missing) {
      var sortObj = {"field": field};
      var idx = this.findSort(field);
      if (idx == -1) {
          idx = this.sorts.length;
          this.sorts.push({"field": field, "order": order, "mode": mode, "missing": missing});
      } else {
          this.sorts[idx] = {"field": field, "order": order, "mode": mode, "missing": missing}; // update
      }
      return this;
    },
    "removeSort": function(field, order, mode, missing) {
      var idx = this.findSort(field);
      if (idx != -1) {
        Utils.array_remove(idx);
        return this;
      }
      return this;
    },
    "getSearchURL": function(simpleQuery) {
      var url = this.client.baseurl+this.indices+this.type+"/_search";
      if (Utils.isUndefinedOrNull(simpleQuery) || (!simpleQuery)) {
        return url;
      }
      return url + "?" + Utils.serialize(this.searchUrlVals);
    },
    "getBody": function(logstuff) {
      var querySearchBody = {};
      var queryPart = this.query.getBody(logstuff);
      if (queryPart != null) {
        querySearchBody.query = queryPart.query; // the root search should only have a query part, the filter portion is delegated to the post_filter, any filters are sub-filters of the query
      }
      var filterPart = this.post_filter.getBody(logstuff);
      if (filterPart != null) {
        querySearchBody.post_filter = filterPart;
      }
      return querySearchBody;
    },
    /**
      http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html

      @method search Performs a basic query
    */
    "simpleQueryStringSearch": function(queryString, cacheName) {
      this.searchUrlVals.q = queryString;
      return this.client.ajax(this.getSearchURL(true), null, cacheName, null);
    },
    "execute": function(cacheName) {
      var ajaxOpts = {
        type: "POST"
      };
      return this.client.ajax(this.getSearchURL(true), this.getBody(), cacheName, ajaxOpts);
    }
  });

  ES.FieldTypes = {
    "Bool": {'fields': {
                'must': {'type': 'queryArray'},
                'should': {'type': 'queryArray'},
                'must_not': {'type': 'queryArray'},
                'minimum_should_match': {'type': 'value'},
                'boost': {'type': 'value'},
             }
    },
    "Boosting": {'fields': {
                   'positive': {'type': 'queryArray'},
                   'negative': {'type': 'queryArray'},
                   'boost': {'type': 'value'},
                   'negative_boost': {'type': 'value'},
                 }
    },
    "CommonValue": {'accessor': 'term:CommonValueOpts'},
    "CommonValueOpts": {
                 'fields': {
                   'query': {'type': "value"},
                   'cutoff_frequency': {'type': "value"},
                   'low_freq_operator': {'type': "value"},
                   'minimum_should_match': {'type': "value"}
                 }
    },
    "DisMax": {'fields': {
                 'queries': {'type': 'queryArray'},
                 'boost': {'type': 'value'},
                 'tie_breaker': {'type': 'value'},
                },
    },
    "Fuzzy": {'accessor': 'term:FuzzyOpts'},
    "FuzzyOpts": {'fields': {
                         'value': {'type': 'value'},
                         'boost': {'type': 'value'},
                         'fuzziness': {'type': 'value'},
                         'prefix_length': {'type': 'value'},
                         'max_expansions': {'type': 'value'}
                     },
    },
    "FuzzyLikeThis": {'fields': {
                         'fields': {'type': 'value'},
                         'like_text': {'type': 'value'},
                         'ignore_tf': {'type': 'value'},
                         'max_query_terms': {'type': 'value'},
                         'fuzziness': {'type': 'value'},
                         'prefix_length': {'type': 'value'},
                         'boost': {'type': 'value'},
                         'analyzer': {'type': 'value'}
                     },
    },
    "GeoShape": {'accessor': 'term:GeoShapeOpts'},
    "GeoShapeOpts": {// http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/mapping-geo-shape-type.html
                 'fields': {
                   'shape': {'type': 'value'}, // {"coordinates": coordinates, "type": shapeType}
                   'indexed_shape': {'type': 'value'}, // { "id": id, "type": type, "index": index, "path": path }
                 }
    },
    "HasChild": {'fields': {
                   'query': {'type': 'queryTypeValue'},
                   'type': {'type': 'value'},
                   'filter': {'type': 'filterTypeValue'},
                   'score_mode': {'type': 'value'},
                   'min_children': {'type': 'value'},
                   'max_children': {'type': 'value'}
                }
    },
    "HasParent": {'fields': {
                   'query': {'type': 'queryTypeValue'},
                   'parent_type': {'type': 'value'},
                   'score_mode': {'type': 'value'}
                },
    },
    "Ids": {'fields': {
                   'type': {'type': 'value'},
                   'values': {'type': 'value'}
                }
    },
    "Indices": {'fields': {
                   'query': {'type': 'queryTypeValue'},
                   'no_match_query': {'type': 'queryTypeValue'},
                   'indices': {'type': 'value'}
                }
    },
    "MatchAll": {'fields': {
                   'boost': {'type': 'value'},
                }
    },
    "MoreLikeThis": {
                 'fields': {
                   'fields': {'type': 'value'},
                   'like_text': {'type': 'value'},
                   'docs': {'type': 'value'},
                   'ids': {'type': 'value'},
                   'include': {'type': 'value'},
                   'exclude': {'type': 'value'},
                   'percent_terms_to_match': {'type': 'value'},
                   'min_term_freq': {'type': 'value'},
                   'max_query_terms': {'type': 'value'},
                   'stop_words': {'type': 'value'},
                   'min_doc_freq': {'type': 'value'},
                   'max_doc_freq': {'type': 'value'},
                   'min_word_length': {'type': 'value'},
                   'max_word_length': {'type': 'value'},
                   'boost_terms': {'type': 'value'},
                   'boost': {'type': 'value'},
                   'analyzer': {'type': 'value'}
                 }
    },
    "MoreLikeThis": {
                 'fields': {
                   'fields': {'type': 'value'},
                   'like_text': {'type': 'value'},
                   'docs': {'type': 'value'},
                   'ids': {'type': 'value'},
                 }
    },
    "Nested": {
                 'fields': {
                   'query': {'type': 'queryTypeValue'},
                   'path': {'type': 'value'},
                   'score_mode': {'type': 'value'}
                 }
    },
    "Prefix": {'accessor': 'term:PrefixOpts'},
    "PrefixOpts": {
                 'fields': {
                   'value': {'type': 'value'},
                   'prefix': {'type': 'value'},
                   'boost': {'type': 'value'}
                 }
    },
    "QueryString": {
                 'fields': {
                   'query': {'type': 'value'},
                   'default_field': {'type': 'value'},
                   'default_operator': {'type': 'value'},
                   'analyzer': {'type': 'value'},
                   'allow_leading_wildcard': {'type': 'value'},
                   'lowercase_expanded_terms': {'type': 'value'},
                   'enable_position_increments': {'type': 'value'},
                   'fuzzy_max_expansions': {'type': 'value'},
                   'fuzziness': {'type': 'value'},
                   'fuzzy_prefix_length': {'type': 'value'},
                   'phrase_slop': {'type': 'value'},
                   'boost': {'type': 'value'},
                   'analyze_wildcard': {'type': 'value'},
                   'auto_generate_phrase_queries': {'type': 'value'},
                   'max_determinized_states': {'type': 'value'},
                   'minimum_should_match': {'type': 'value'},
                   'lenient': {'type': 'value'},
                   'locale': {'type': 'value'},
                   'use_dis_max': {'type': 'value'},
                   'tie_breaker': {'type': 'value'},
                 }
    },
    "SimpleQueryString": {
                 'fields': {
                   'query': {'type': 'value'},
                   'fields': {'type': 'value'},
                   'default_operator': {'type': 'value'},
                   'analyzer': {'type': 'value'},
                   'flags': {'type': 'value'},
                   'lowercase_expanded_terms': {'type': 'value'},
                   'locale': {'type': 'value'},
                   'lenient': {'type': 'value'}
                 }
    },
    "RangeQuery": {'accessor': 'term:RangeQueryOpts'},
    "RangeQueryOpts": {
                 'fields': {
                   'gte': {'type': 'value'},
                   'gt': {'type': 'value'},
                   'lte': {'type': 'value'},
                   'lt': {'type': 'value'},
                   'boost': {'type': 'value'},
                 }
    },
    "RegExp": {'accessor': 'term:RegExpOpts'},
    "RegExpOpts": {
                 'fields': {
                   'value': {'type': 'value'},
                   'flags': {'type': 'value'},
                   'max_determinized_states': {'type': 'value'},
                   'boost': {'type': 'value'}
                 }
    }, // http://stackoverflow.com/questions/20748647/boosting-field-prefix-match-in-elasticsearch
    "SpanFirst": {
                 'fields': {
                   'match': {'type': 'SpanFirstMatch'},
                   'end': {'type': 'value'},
                 }
    },
    "SpanFirstMatch": {
                 'fields': {
                   'span_multi': {'type': 'SpanMulti'},
                   'span_near': {'type': 'SpanNear'},
                   'span_not': {'type': 'SpanNot'},
                   'span_or': {'type': 'SpanOr'},
                   'span_term': {'type': 'SpanTerm'},
                 }
    },
    "SpanMulti": {
                 'fields': {
                   'match': {'type': 'SpanMultiMatch'},
                 }
    },
    "SpanMultiMatch": {
                 'fields': {
                   'fuzzy': {'type': "Fuzzy"},
                   'prefix': {'type': "Prefix"},                   
                   'range': {'type': "Range"},
                   'term': {'type': "Term"},
                   'wildcard': {'type': "Wildcard"},
                 }
    },
    "Term": {'accessor': 'term:TermOpts'},
    "TermOpts": {
                 'fields': {
                   'value': {'type': 'value'},
                   'prefix': {'type': 'value'},
                   'boost': {'type': 'value'}
                 }
    },    
    "Terms": {
                 'fields': {
                   'tags': {'type': 'value'},                   
                   'minimum_should_match': {'type': 'value'}
                 }
    },
    "TopChildren": {
                 'fields': {
                   'type': {'type': 'value'},                   
                   'query': {'type': 'queryTypeValue'},
                   'score': {'type': 'value'},
                   'factor': {'type': 'value'},
                   'incremental_factor': {'type': 'value'}
                 }
    },
    "Wildcard": {'accessor': 'term:WildcardOpts'},
    "WildcardOpts": {
                 'fields': {
                   'value': {'type': 'value'},
                   'wildcard': {'type': 'value'},
                   'boost': {'type': 'value'}
                 }    
    },       
    "AndFilter": {'fields': {
                'filters': {'type': 'filterArray'},
                '_cache': {'type': 'value'}
             }
    },
    "BoolFilter": {'fields': {
                'must': {'type': 'filterArray'},
                'should': {'type': 'filterArray'},
                'must_not': {'type': 'filterArray'},
                'minimum_should_match': {'type': 'value'},
                'boost': {'type': 'value'},
             }             
    },
    "ExistsFilter": {'fields': {
                'field': {'type': 'value'}
             }             
    },
    "GeoBoundingBoxFilter": {'fields': {
                'type': {'type': 'value'},
                '_cache': {'field': 'value'}
             }
    },    
    "GeoDistanceFilter": {
                'accessor': 'term:<none>',
                'fields': {
                'distance': {'type': 'value'},
                'distance_type': {'type': 'value'},
                'optimize_bbox': {'type': 'value'},
                '_cache': {'type': 'value'}
             }
    },
    "Mapping": {'accessor': 'term:MappingOpts'},
    "MappingOpts": {
           'fields': {
                'properties': {'type': 'FieldDefinitions'}
           }
    },
    "FieldDefinitions": {'accessor': 'term:FieldDefinitionOpts'},
    "FieldDefinitionOpts": {
           'fields': { // type -- string, integer/long, float/double, boolean, and null, (also object/nested/attachment)
                'type': {'type': 'value'},
                'dynamic': {'type': 'value'},
                'enabled': {'type': 'value'},
                'include_in_all': {'type': 'value'},
                'properties': {'type': 'FieldDefinitions'}
             }
    },
        
    "queryArray": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = [];
            }
            var q = new ES.Query(this, true);
            this.values[fieldName].push(q);
            return q;
        };
      }
    },
    "value": {
      "accessor": function(fieldName) {
        return function(value) {
          //console.log(this.up(), this.values, value);
            this.values[fieldName] = value;
            return this;
        };
      }
    },
    "queryTypeValue": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new ES.Query(this, true);
            }
            return this.values[fieldName];
        };
      }
    },
    "QueryTypeValueVisible": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new ES.Query(this);
            }
            return this.values[fieldName];
        };
      }
    },
    "filterArray": {
       "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = [];
            }
            var q = new ES.Filter(this);
            this.values[fieldName].push(q);
            return q;
        };
      }
    },
    "filterTypeValue": {
      "accessor": function(fieldName) {
        return function() {
            if (typeof this.values[fieldName] == "undefined") {
              this.values[fieldName] = new ES.Filter(this);
            }
            return this.values[fieldName];
        };
      }
    },    
  };

  function createType(typeInfo, typeName) {
    var FieldType = function(parent) {
      //console.trace();
      //console.log(parent);
      this.up = function() { return parent; }
      this.values = {};
      for(fieldName in typeInfo.fields) {
        //console.log(typeName, fieldName);
        this[fieldName] = ES.FieldTypes[typeInfo.fields[fieldName].type].accessor(fieldName);
      }
      this.getBody = function(logstuff) { return Utils.getQueryDSLStruct(this.values, logstuff); }
      this.typeName = typeName;
    }

    if (typeof typeInfo.accessor == "string") {
      if (typeInfo.accessor.substring(0, 5) == "term:") {
        var subTypeStr = typeInfo.accessor.substring(5);
        var subType = ES.FieldTypes[subTypeStr];
        
        typeInfo.accessor = function(fieldName) {
              return function(term, value) {
                if (typeof this.values[fieldName] == "undefined") {
                  this.values[fieldName] = new FieldType(this);                  
                }
                if (typeof this.values[fieldName].values[term] == "undefined") {
                  if (subTypeStr === "<none>") {                    
                     this.values[fieldName].values[term] = {}; // just an obj
                  } else {                    
                     this.values[fieldName].values[term] = new subType.constructor(this.values[fieldName]);
                  }                
                }
                if (typeof value != 'undefined') {
                  this.values[fieldName].values[term] = value;
                }
                if (subTypeStr === "<none>") {
                  return this.values[fieldName];
                } else {
                  return this.values[fieldName].values[term];
                }
              };
        };
      }
    } else {
      typeInfo.accessor = function(fieldName) {
            return function(value) {
              if (typeof this.values[fieldName] == "undefined") {
                this.values[fieldName] = new FieldType(this);
              } 
              if (typeof value != 'undefined') {
                  this.values[fieldName].values = value;
              }              
              return this.values[fieldName];
            };
      };
    }
    return FieldType;
  }

  for(type in ES.FieldTypes) {
    if ((typeof ES.FieldTypes[type].accessor == "undefined") || (typeof ES.FieldTypes[type].accessor == "string")) {
      ES.FieldTypes[type].constructor = createType(ES.FieldTypes[type], type); //sets the accessor and the constructor for a simple type
    }
  }

  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-queries.html
  ES.Query = function(parent, queryOnly) {
    this.up = function() { return parent; }
    this.values = {};
    var fields = {
       'boosting': {'type': 'Boosting'},
       'bool': {'type': 'Bool'},
       'common': {'type': 'CommonValue'},
       'constant_score': {'type': 'QueryTypeValueVisible'},
       'dis_max': {'type': 'DisMax'},
       'filtered': {'type': 'QueryTypeValueVisible'},
       'flt': {'type': 'FuzzyLikeThis'},
       'fuzzy': {'type': 'Fuzzy'},
       'fuzzy_like_this': {'type': 'FuzzyLikeThis'},
       'geo_shape': {'type': "GeoShape"},
       'has_child': {'type': 'HasChild'},
       'has_parent': {'type': 'HasParent'},
       'ids': {'type': 'Ids'},
       'indices': {'type': 'Indices'},
       'match_all': {'type': 'MatchAll'},
       'more_like_this': {'type': 'MoreLikeThis'},
       'nested': {'type': 'Nested'},
       'prefix': {'type': 'Prefix'},
       'query_string': {'type': 'QueryString'},
       'range': {'type': 'RangeQuery'},
       'regexp': {'type': 'RegExp'},
       'simple_query_string': {'type': 'SimpleQueryString'},
       'term': {'type': 'Term'},
       'terms': {'type': 'Terms'},
       'top_children': {'type': 'TopChildren'},
       'wildcard': {'type': 'Wildcard'}
    };
    for(fieldName in fields) {
       //console.log(fieldName);
       this[fieldName] = ES.FieldTypes[fields[fieldName].type].accessor(fieldName);
    }
    this.queryOnly = ((typeof queryOnly != "undefined") && queryOnly) ? queryOnly : false;
    this.filter = new ES.Filter(this);
  }

  $.extend(ES.Query.prototype, {
    "getBody": function(logstuff) {
      var querySearchBody = {};
      //console.log("--------", this.values);
      var queryPart = Utils.getQueryDSLStruct(this.values, logstuff);
      //console.log(queryPart);
      if (queryPart != null) {
        if (this.queryOnly) {
          return queryPart;
        }
        querySearchBody.query = queryPart;
      }
      var filterPart = this.filter.getBody(logstuff);
      if (filterPart != null) {
        querySearchBody.query.filter = filterPart;
      }
      if (Object.keys(querySearchBody).length > 0) {
        return querySearchBody;
      } else {
        return null;
      }
    }
  });

  // http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-filters.html
  ES.Filter = function(parent) {
    this.up = function() { return parent; }
    this.values = {};
    var fields = {
       'and': {'type': 'AndFilter'},
       'bool': {'type': 'BoolFilter'},
       'exists': {'type': 'ExistsFilter'},
       'term': {'type': 'Term'},
       'geo_bounding_box': {'type': "GeoBoundingBoxFilter"},
       'geo_distance': {'type': "GeoDistanceFilter"},
    };
    for(fieldName in fields) {
       //console.log(fieldName);
       this[fieldName] = ES.FieldTypes[fields[fieldName].type].accessor(fieldName);
    }
    this.getBody = function(logstuff) {return Utils.getQueryDSLStruct(this.values, logstuff)};
  }  
  
  ES.Mapping = function() {
    var that = this;
    this.up = function() { return that }
    this.values = {};
    var fields = {
       'mapping': {'type': 'Mapping'},
    };
    for(fieldName in fields) {       
       this[fieldName] = ES.FieldTypes[fields[fieldName].type].accessor(fieldName);
    }
    this.getBody = function(logstuff) {return this.values['mapping'].getBody()};
  }  

	window.ES = ES;
	return ES;
});