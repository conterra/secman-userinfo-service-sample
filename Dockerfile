FROM node:lts-alpine AS server-build
WORKDIR /usr/src/userinfosrv
# copy resources
COPY . .
RUN npm install && npm run full-build

FROM node:lts-alpine
WORKDIR /usr/src/userinfosrv/
COPY --from=server-build /usr/src/userinfosrv/dist ./

EXPOSE 9090

CMD ["node", "./index.js"]
