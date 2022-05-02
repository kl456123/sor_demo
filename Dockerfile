# syntax=docker/dockerfile:1
FROM node:14.17.4

WORKDIR /app

# COPY ["package.json", "yarn-lock.json", "./"]


COPY . .

RUN yarn config set registry https://registry.npm.taobao.org/
RUN yarn
RUN yarn build

CMD yarn hardhat node
