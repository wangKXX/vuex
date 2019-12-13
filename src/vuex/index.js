/**
 * 对内变量全部采用 ‘_’ 命名
 * 
 */
let _vue = null;

class Store {
  _subscribeCache = []
  _subscribeActionCache = []
  _makeLocalGettersCache = Object.create(null)

  constructor(options) {
    this.options = options;
    this._optionsSplit();
    this._initStore();
    this._watchVM = new _vue();
  }

  get state() {
    return this._state;
  }

  dispatch = (key, payload) => {
    return Promise.resolve(this._dispatch(key, payload));
  }

  commit = (key, payload) => {
    this._commit(key, payload);
  }

  subscribe(fn) {
    return this._subscribe(fn);
  }

  subscribeAction(fn) {
    return this._subscribeAction(fn);
  }

  watch(fn, cb, options) {
    return this._watch(fn, cb, options);
  }

  _watch(fn, cb, options) {
    this._watchVM.$watch(() => fn(this.state, this.getters), cb, options);
  }

  _initStore() {
    // 判断有没有_modules,如果有的将_modules解构
    const stateMap = { ... this.options.state };
    this._rootStateCache = this.options.state;
    this._rootGettersCache = this.options.getters;
    if (isHasModules(this._modules)) {
      modulesStateDeconstruct(stateMap, this._modules, 'state');
    }
    this.getters = Object.create(null);
    const computed = Object.create(null);
    Object.keys(this._getters).forEach(key => {
      computed[key] = () => {
        return this._getters[key]();
      };
      Object.defineProperty(this.getters, key, {
        get: () => this._vm[key],
        enumerable: true
      });
    })

    this._vm = new _vue({
      data: {
        $$store: stateMap
      },
      computed
    });
    this._state = this._vm.$data.$$store;
    Object.defineProperties(this, {
      rootState: {
        get: () => makeRootState(this._rootStateCache, this._state)
      },
      rootGetters: {
        get: () => makeRootGetters(this._rootGettersCache, this._vm)
      }
    })
  }

  _commit(key, payload) {
    const entry = this._mutations[key];
    if (!entry) {
      console.error("[vuex] unknown mutation type: " + key);
      return;
    }
    let fn = entry['fn'];
    if (typeof fn === 'function') {
      fn(payload);
      this._subscribeCache.forEach(fn => {
        fn({ type: key, payload }, this.state);
      })
    }
  }

  // dispatch支持传入对象或者字符串参数形式
  _dispatch(key, payload) {
    const ref = splitObject(key, payload);
    key = ref.type;
    payload = ref.payload;
    const entry = this._actions[key];
    if (!entry) {
      console.error("[vuex] unknown actions type: " + key);
      return;
    }
    const fn = entry['fn'];
    if (typeof entry['fn'] === 'function') {
      const result = Promise.resolve(fn(payload));
      result.then(() => {
        this._subscribeActionCache.forEach(fn => {
          fn({ type: key, payload }, this.state);
        })
      })
      return result;
    }
  }

  _subscribe(fn) {
    const len = this._subscribeCache.push(fn);
    return () => {
      this._subscribeCache.splice(len - 1, 1);
    }
  }

  _subscribeAction(fn) {
    const len = this._subscribeActionCache.push(fn);
    return () => {
      this._subscribeActionCache.splice(len - 1, 1);
    }
  }

  _optionsSplit() {
    this._modules = this.options['modules'];
    // 初始化时为每一个 mutations actions 绑定对应的commit方法和dispatch方法
    this._mutations = extendMoudle(this.options['mutations'], this._modules, 'mutations', this);
    this._actions = extendMoudle(this.options['actions'], this._modules, 'actions', this);
    this._getters = extendGetters(this.options['getters'], this._modules, this);
  }
}

/**
 * 
 * @param {object} rootStateMap 原始根state 
 * @param {object} state Observe对象
 */
function makeRootState(rootStateMap, state) {
  const rootStateProxy = Object.create(null);
  Object.keys(state).forEach(key => {
    const rootStateArray = Object.keys(rootStateMap);
    if (rootStateArray.includes(key)) {
      Object.defineProperties(rootStateProxy, {
        [key]: {
          get: () => state[key]
        }
      })
    }
  })
  return rootStateProxy;
}

/**
 * 
 * @param {objct} rootGettersMap 原始根getters
 * @param {*} vm vue实例
 */
function makeRootGetters(rootGettersMap, vm) {
  const rootGettersProxy = Object.create(null);
  Object.keys(rootGettersMap).forEach(getterKey => {
    Object.defineProperty(rootGettersProxy, getterKey, {
      get: () => vm[getterKey],
      enumerable: true
    })
  });
  return rootGettersProxy;
}

/**
 * 
 * @param {object | Array} params 
 * 将参数统一处理为对象
 */
function normalizeParams(params) {
  let res = Object.create(null);
  if (Array.isArray(params)) {
    params.forEach(key => {
      res[key] = key;
    })
  } else {
    res = params;
  }

  return res;
}

function normalizeNamespace(fn) {
  return function (nameSpace, getters) {
    if (typeof nameSpace !== 'string') {
      getters = nameSpace;
      nameSpace = '';
    }
    return fn(nameSpace, getters);
  }
}

function makeLocalGetters(namespace, store) {
  const local = Object.create(null)
  Object.defineProperty(local, 'getters', {
    get: function () {
      return makeLocalGetter(namespace, store)
    },
    enumerable: true
  })

  return local;
}
function makeLocalGetter(namespace, store) {
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = Object.create(null);
    const splitPos = namespace.length;
    Object.keys(store.getters).forEach(function (type) {
      if (type.slice(0, splitPos) !== namespace) { return }
      var localType = type.slice(splitPos + 1);
      Object.defineProperty(gettersProxy, localType, {
        get: function () { return store.getters[type]; },
        enumerable: true
      });
    });
    store._makeLocalGettersCache[namespace] = gettersProxy;
  }
  return store._makeLocalGettersCache[namespace]
}

// getters处理
function extendGetters(rootGetters, moudles, store) {
  return {
    ...wrapperGetters(rootGetters, store),
    ...wrapperGetters(moudles, store)
  }
}

function wrapperGetters(moudles, store) {
  const res = Object.create(null);
  Object.keys(moudles).forEach(nameSpace => {
    if (typeof moudles[nameSpace] === 'object') {
      const { namespaced } = moudles[nameSpace];
      const getters = moudles[nameSpace]['getters'];
      Object.keys(getters).forEach(getterKey => {
        namespaced && (
          res[`${nameSpace}/${getterKey}`] =
          wrapGettersFn.bind(null, getters[getterKey], nameSpace, store));
        namespaced || (
          res[getterKey] = wrapGettersFn.bind(null, getters[getterKey], '', store));
        // 每个模块内的getters缓存起来
      })
    }
    if (typeof moudles[nameSpace] === 'function') {
      res[nameSpace] =
        wrapGettersFn.bind(null, moudles[nameSpace], '', store, nameSpace);
    }

  })
  return res;
}
/**
 * 
 * @param {function} fn 最终执行的方法
 * @param {string} nameSpace 模块名
 * @param {Store} store store对象
 * @param {string} moduleKey getter完整的调用路径
 */
function wrapGettersFn(fn, nameSpace, store) {
  // 如果为根节点下接受两个参数 state getters 都为全局， 模块内接受四个参数 state, getters, rootState, rootGetters

  const isRoot = nameSpace === '';
  const local = isRoot ? '' : makeLocalGetters(nameSpace, store);
  const params = isRoot ? [
    store.state,
    store.getters
  ] : [
      store.state[nameSpace],
      local.getters,
      store.rootState,
      store.rootGetters
    ]
  // isRoot || (params.splice(1, 1, getChildrenGetters(store.getters, nameSpace)));
  return fn.apply(store, [...params]);
}

// mutations, actions解构处理
function extendMoudle(sourceObj, modules, type, store) {
  return {
    ...deconstructMoudles(sourceObj, type, store),
    ...deconstructMoudles(modules, type, store)
  };
}

function deconstructMoudles(modules, type, store) {
  let res = Object.create(null);
  // 返回的对象上应该有path 对应的触发方法
  Object.keys(modules).forEach(key => {
    if (typeof modules[key] === 'object') {
      const { namespaced } = modules[key];
      const innerMoudles = modules[key][type];
      Object.keys(innerMoudles).forEach(item => {
        // 需要保存触发函数的执行上下文
        namespaced && (res[`${key}/${item}`] = {
          fn: wrapperCommitDispatch.bind(null, innerMoudles[item],
            key, store, type), isRoot: false
        });
        namespaced || (res[item] = {
          fn: wrapperCommitDispatch.bind(null, innerMoudles[item], '', store, type),
          isRoot: false
        })
      })
    }
    if (typeof modules[key] === 'function') {
      res[key] = {
        fn: wrapperCommitDispatch.bind(null, modules[key], '', store, type),
        isRoot: true
      }
    }
  })
  return res;
}

// 保存函数的执行上下文
function wrapperCommitDispatch(fun /**发的原方法 */, spaceName, store, type, payload) {
  const isRoot = spaceName === '';
  const dispatch = isRoot ? store.dispatch : function (_type, _payload, _options) {
    let type = _type;
    if (!_options || !_options.root) {
      // 非根状态需要加上spaceName
      type = `${spaceName}/${_type}`
    }

    store.dispatch(type, _payload, _options);
  }
  const local = isRoot ? '' : makeLocalGetters(spaceName, store);
  const commit = isRoot ? store.commit : function (_type, _payload, _options) {
    let type = _type;
    if (!_options || _options.root) {
      // 非根状态需要加上spaceName
      type = `${spaceName}/${_type}`
    }
    store.commit(type, _payload, _options);
  }
  const params = {
    dispatch,
    commit,
    state: isRoot ? store.state : store.state[spaceName],
    getters: isRoot ? store.getters : local.getters
  }
  const rootState = store.rootState;
  const rootGetters = store.rootGetters;
  isRoot || Object.assign(params, { rootState, rootGetters });
  if (type === 'actions') {
    return Promise.resolve(fun.call(store, params, payload));
  } else {
    fun.call(store, isRoot ? store.state : store.state[spaceName], payload);
  }
}

function modulesStateDeconstruct(sourceObj, modules, type) {
  Object.keys(modules).forEach(item => {
    const { namespaced } = modules[item];
    if (namespaced) {
      Object.assign(sourceObj, { [item]: { ...modules[item][type] } });
    } else {
      Object.assign(sourceObj, { ...modules[item][type] });
    }
  });
}

function isHasModules(modules) {
  return Object.keys(modules).length > 0;
}

function splitObject(type, payload) {
  if (typeof type === 'object' && type.type) {
    payload = type;
    type = type.type;
  }
  typeof type === 'string' || (
    console.error("expects string as the type, but found " + (typeof type) + ".")
  )
  return { type: type, payload: payload }
}

/**
 * getters Array | Object { key: state }
 */
const mapGetters = normalizeNamespace(function (nameSpace, getters) {
  getters = normalizeParams(getters);
  const res = Object.create(null);
  const isRoot = nameSpace === ''
  Object.keys(getters).forEach(key => {
    res[key] = function () {
      const getterKey = isRoot ? getters[key] : `${nameSpace}/${getters[key]}`;
      return this.$store.getters[getterKey]
    };
  })
  return res;
})

/**
 * state Array | Object { key: state } | Objct { key： function }
 */
const mapState = normalizeNamespace(function (nameSpace, state) {
  state = normalizeParams(state);
  const res = Object.create(null);
  const isRoot = nameSpace === '';
  Object.keys(state).forEach(stateKey => {
    res[stateKey] = function () {
      if (isRoot) {
        // if state[stateKey] is a function
        if (typeof state[stateKey] === 'function') {
          return state[stateKey](this.$store.state);
        } else {
          return this.$store.state[state[stateKey]];
        }
      } else {
        if (typeof state[stateKey] === 'function') {
          return state[nameSpace][stateKey](this.$store.state[nameSpace]);
        } else {
          return this.$store.state[nameSpace][state[stateKey]];
        }
      }
    }
  })
  return res;
})
/**
 * mapActions(namespace?: string, map: Array<string> | Object<string | function>): Object
 */
const mapActions = normalizeNamespace(function (nameSpace, actions) {
  actions = normalizeParams(actions);
  const isRoot = nameSpace === '';
  const res = Object.create(null);
  Object.keys(actions).forEach(actionsKey => {
    res[actionsKey] = function (payload) {
      if (typeof actions[actionsKey] === 'function') {
        // 在第二个参数是函数的情况把所有的dispath做为参数返回
        return actions[actionsKey](this.$store.dispatch);
      } else {
        const Key = isRoot ? actions[actionsKey] : `${nameSpace}/${actions[actionsKey]}`;
        return this.$store.dispatch(Key, payload);
      }
    }
  })

  return res;
})

/**
 * mapMutations(namespace?: string, map: Array<string> | Object<string | function>): Object
 */
const mapMutations = normalizeNamespace(function (nameSpace, mutations) {
  mutations = normalizeParams(mutations);
  const isRoot = nameSpace === '';
  const res = Object.create(null);
  Object.keys(mutations).forEach(mutationsKey => {
    res[mutationsKey] = function (payload) {
      if (typeof mutations[mutationsKey] === 'function') {
        return mutations[mutationsKey](this.$store.commit);
      } else {
        const Key = isRoot ? mutations[mutationsKey] : `${nameSpace}/${mutations[mutationsKey]}`;
        return this.$store.commit(Key, payload);
      }
    }
  })

  return res;
})

/**
 * 
 * @param {String} nameSpace 
 */
const createNamespacedHelpers = function (nameSpace) {
  mapMutations.bind(null, nameSpace);
  mapActions.bind(null, nameSpace);
  mapGetters.bind(null, nameSpace);
  mapState.bind(null, nameSpace);
  return { mapState, mapGetters, mapActions, mapMutations };
};

const install = (vue) => {
  _vue = vue;
  _vue.mixin({ beforeCreate: vuexInit })
}

function vuexInit() {
  const options = this.$options;
  if (options.store) { // 根组件
    this.$store = options.store
  } else if (options.parent && options.parent.$store) {
    this.$store = options.parent.$store;
  }
}

module.exports = {
  Store,
  install,
  mapGetters,
  mapState,
  mapActions,
  mapMutations,
  createNamespacedHelpers
};