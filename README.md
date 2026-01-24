# Ecommerce Lite Node.js App

Simple ecommerce demo with a landing page, SQLite storage, Prometheus `/metrics`, plus Docker, Helm, Argo CD, Grafana, and GitHub Actions examples.

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
docker run -p 3000:3000 -v "$PWD/data:/app/data" ecommerce-lite:local
```

SQLite database path defaults to `./data/app.db`. Override with `DB_PATH`.

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

## Database (SQLite)

Orders and order items are stored in SQLite for demo purposes.

- Default path: `./data/app.db`
- Override path: `DB_PATH=/custom/path/app.db`

Example:

```bash
DB_PATH=./data/app.db npm start
```

List recent orders:

```bash
curl http://localhost:3000/api/orders
```

### Kubernetes persistence

SQLite data can be persisted via a PVC. Configure in `helm/ecommerce-lite/values.yaml`:

```yaml
persistence:
  enabled: true
  accessMode: ReadWriteOnce
  size: 1Gi
  storageClass: ""
  mountPath: /app/data
  existingClaim: ""
```

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

## Logs

Application logs are JSON to stdout (structured logs). Examples:

```bash
docker logs <container-id>
kubectl logs -n devops-exam -l app=ecommerce-lite --tail=100
```

To view logs in Grafana, open Explore and use the Loki datasource:

```
{namespace="devops-exam", app="ecommerce-lite"}
```
