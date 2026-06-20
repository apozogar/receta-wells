# Etapa 1: Construcción
FROM node:22.19.0-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
# Compila la aplicación para producción
RUN npm run build

# Etapa 2: Servidor Web (Nginx)
FROM nginx:alpine

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los archivos compilados. NOTA: Verifica si tu carpeta dist tiene subcarpeta 'browser' (Angular 17+)
COPY --from=build /usr/src/app/dist/menubox/browser /usr/share/nginx/html

EXPOSE 80