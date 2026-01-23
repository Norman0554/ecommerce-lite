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

## Kubernetes (Helm)

Update the image in `helm/ecommerce-lite/values.yaml`, then:

```bash
helm upgrade --install devops-exam ./helm/ecommerce-lite --namespace devops-exam --create-namespace
```

Open the site:

```bash
kubectl port-forward svc/ecommerce-lite 3002:80 -n devops-exam
```

Then visit `http://localhost:3002/`.

## Argo CD

Edit `deploy/argocd-application.yaml` with your repo URL and `path: helm/ecommerce-lite`, then:

```bash
kubectl apply -f deploy/argocd-application.yaml
```

## Grafana

The Helm chart includes a dashboard `ConfigMap` labeled `grafana_dashboard=1`.
Import it automatically if your Grafana watches dashboard ConfigMaps.

Open Grafana:

```bash
kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3001:80
```

Visit `http://localhost:3001` and login as `admin`.
Get the password:

```bash
kubectl -n monitoring get secret kube-prometheus-stack-grafana \
  -o jsonpath="{.data.admin-password}" | base64 -d; echo
```

## Metrics

Prometheus should scrape `http://<service>:3000/metrics`.
A `ServiceMonitor` is included when `serviceMonitor.enabled=true`.
If you use kube-prometheus-stack, the default selector expects `release: kube-prometheus-stack`.
You can override it with `serviceMonitor.releaseLabel` in `helm/ecommerce-lite/values.yaml`.
