This is sort of a Roadmap/Featurelist, a simple way to track what is or isn't supported
yet as part of esjs.

Legend: 
------
Done - Code Support, Documented, Tested
Mostly Done - Coded but either Documented or Tested, but not both
Coded - Code support



Query Type                    | Status
------------------------------|-----------
match query                   |  
multi match query             | 
bool query                    | Coded
boosting query                | Coded
common terms query            | Coded
constant score query          | Mostly Done
dis max query                 | Coded
filtered query                | Coded
fuzzy like this query         | Coded
fuzzy like this field query   | (not needed)
function score query          | 
fuzzy query                   | Coded
geoshape query                | Coded
has child query               | Coded
has parent query              | Coded
ids query                     | Coded
indices query                 | Coded
match all query               | Coded
more like this query          | Coded
more like this field query    | *deprecated, so not coded*
nested query                  | Coded
prefix query                  | Done
query string query            | Coded
simple query string query     | Coded
range query                   | Coded
regexp query                  | Coded
span first query              |
span multi term query         |
span near query               |
span not query                |
span or query                 |
span term query               |
term query                    |
terms query                   |
top children query            |
wildcard query                |
minimum should match          |
multi term query rewrite      |
template query                |


Filter Type                   | Status
------------------------------|----------
and filter                    |
bool filter                   |
exists filter                 |
geo bounding box filter       |
geo distance filter           |
geo distance range filter     |
geo polygon filter            |
geoshape filter               |
geohash cell filter           |
has child filter              |
has parent filter             |
ids filter                    |
indices filter                |
limit filter                  |
match all filter              |
missing filter                |
nested filter                 |
not filter                    |
or filter                     |
prefix filter                 |
query filter                  |
range filter                  |
regexp filter                 |
script filter                 |
term filter                   |
terms filter                  |
type filter                   |
