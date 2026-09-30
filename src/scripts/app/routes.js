const BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}`;

const PAGE_ROUTES = {
  home: '',
  timeline: 'timeline/',
  misc: 'misc/',
  supplies: 'supplies/',
  finance: 'finance/',
  knowledge: 'knowledge/'
};

export function pageHref(page) {
  return `${BASE_URL}${PAGE_ROUTES[page] || ''}`;
}

export { BASE_URL, PAGE_ROUTES };
