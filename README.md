# Ecommerce Lite Node.js App

Simple ecommerce demo with a landing page, in-memory catalog, Prometheus `/metrics`, plus Docker, Helm, Argo CD, Grafana, and GitHub Actions examples.

## Local run

```bash
npm install
npm start
curl http://localhost:3000/health
curl http://localhost:3000/metrics
open http://localhost:3000
```

## Docker

```bash
docker build -t ecommerce-lite:local .
docker run -p 3000:3000 ecommerce-lite:local
```

## Helm

Update the image in `helm/ecommerce-lite/values.yaml`, then:

```bash
helm install ecommerce-lite helm/ecommerce-lite --namespace ecommerce-lite --create-namespace
```

## Argo CD

Edit `deploy/argocd-application.yaml` with your repo URL, then:

```bash
kubectl apply -f deploy/argocd-application.yaml
```

## Grafana

The Helm chart includes a dashboard `ConfigMap` labeled `grafana_dashboard=1`.
Import it automatically if your Grafana watches dashboard ConfigMaps.

## Metrics

Prometheus should scrape `http://<service>:3000/metrics`.
A `ServiceMonitor` is included when `serviceMonitor.enabled=true`.
