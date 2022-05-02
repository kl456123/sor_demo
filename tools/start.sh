#!/bin/bash

docker-compose up -d

# start node
# 8547 used for forknet node, 8546 used for dex aggregator server
docker run --rm -it -d -p 8547:8545 -p 8546:8546 --network=host --name sor_demo sor_demo

# deploy contracts
docker exec -it sor_demo yarn deploy_local

# start server
docker exec -it sor_demo yarn start


# restore database from dump directory
docker cp dump/ sor_demo_mongodb_1:/data/db/

docker exec -it sordemo_mongodb_1 mongorestore /data/db/dump
