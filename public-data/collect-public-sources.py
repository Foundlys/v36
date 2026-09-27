"""Bounded, unauthenticated collection of public automotive reference sources.

This tool stores immutable observations, not a claim of live API connectivity.
It never follows unknown hosts, authenticates, executes page scripts or retries
access denials. HTML collection honours the site's published robots policy.
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

USER_AGENT = 'Foundly-Public-Reference/1.0'
MAX_BYTES = 8 * 1024 * 1024


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts):
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl, self.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def validate_url(url, hosts):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or p.hostname not in hosts or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Source URL is outside the explicit public HTTPS host allowlist')


def request(url, hosts):
    validate_url(url, hosts)
    opener = urllib.request.build_opener(PublicRedirect(hosts))
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html,application/xml;q=0.9'})
    with opener.open(req, timeout=30) as response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError('Response exceeds the bounded observation size')
        return raw, {'status': response.status, 'resolved_url': response.url, 'content_type': response.headers.get('content-type'), 'etag': response.headers.get('etag'), 'last_modified': response.headers.get('last-modified')}


def collect(job, output):
    url = job['url']
    hosts = set(job.get('allowed_hosts', [urllib.parse.urlsplit(url).hostname]))
    result = {**job, 'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'user_agent': USER_AGENT}
    try:
        if job.get('format') == 'html':
            parsed = urllib.parse.urlsplit(url)
            robots_url = f'{parsed.scheme}://{parsed.netloc}/robots.txt'
            try:
                robots_raw, robots_http = request(robots_url, hosts)
                robots = urllib.robotparser.RobotFileParser(robots_url)
                robots.parse(robots_raw.decode('utf-8', errors='replace').splitlines())
                result['robots'] = {'url': robots_url, 'status': robots_http['status'], 'sha256': hashlib.sha256(robots_raw).hexdigest(), 'allowed': robots.can_fetch(USER_AGENT, url)}
                (output / (job['id'] + '.robots.txt')).write_bytes(robots_raw)
                if not result['robots']['allowed']:
                    result.update(status='ROBOTS_DISALLOWED', records_collected=0)
                    return result
            except urllib.error.HTTPError as exc:
                if exc.code != 404:
                    raise
                result['robots'] = {'url': robots_url, 'status': 404, 'allowed': True}
        raw, metadata = request(url, hosts)
        suffix = job.get('format', 'json')
        filename = job['id'] + '.' + suffix
        (output / filename).write_bytes(raw)
        result.update(metadata, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), path=filename)
        if suffix == 'json':
            parsed = json.loads(raw)
            rows = parsed if isinstance(parsed, list) else parsed.get('results', parsed.get('value'))
            result['records_collected'] = len(rows) if isinstance(rows, list) else None
            if isinstance(parsed, dict) and parsed.get('errors'):
                result.update(status='SOURCE_QUERY_ERROR', errors=parsed['errors'])
    except Exception as exc:
        result.update(status='UNAVAILABLE', error=str(exc)[:500], records_collected=0)
    finally:
        print(json.dumps({k: v for k, v in result.items() if k not in ('allowed_hosts', 'errors')}, ensure_ascii=False), flush=True)
    return result


def main():
    plan = json.loads(Path(sys.argv[1]).read_text())
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=False)
    # Two independent source requests at most; each host's jobs stay sequential.
    groups = {}
    for job in plan:
        groups.setdefault(urllib.parse.urlsplit(job['url']).hostname, []).append(job)
    def collect_group(group):
        results = []
        for job in group:
            result = collect(job, output)
            results.append(result)
            # Preserve completed work even if another host is slow or interrupted.
            (output / (job['id'] + '.receipt.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            page_size = job.get('stop_on_short_page')
            if page_size and (result.get('status') != 200 or isinstance(result.get('records_collected'), int) and result['records_collected'] < page_size):
                break
        return results
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = [r for group in pool.map(collect_group, groups.values()) for r in group]
    (output / 'manifest.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
