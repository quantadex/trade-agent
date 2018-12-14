FROM node:10.14.2
RUN npm install -g yarn

RUN ["mkdir","/app"]
WORKDIR /app
COPY package.json /app
COPY .babelrc /app
COPY index.js /app
RUN npm install
CMD ["npm", "start"]