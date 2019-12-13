<template>
  <div class="home">
    num: {{ $store.state.num }}
    name: {{ $store.state.test.name }},
    newNum: {{ num }},
    newName: {{ newName }},
    addnum: {{ myNum }},
    testName: {{ name }}
    <button @click="$store.commit('ADD_NUM', $store.state.num + 1)">+</button>
    <button @click="$store.dispatch('_add_num', $store.state.num + 1)">异步加</button>
    <button @click="handlerSubrice">改变姓名</button>
    <button @click="handlerAdd">加</button>
    <button @click="handlerAsyncClick">异步namespaced</button>
    <button @click="handleClick">state out</button>
  </div>
</template>

<script>
// @ is an alias to /src
import bigDecimal from 'js-big-decimal';
import { mapGetters, mapState, mapActions, mapMutations } from '../vuex';
// console.log(mapGetters)
export default {
  name: "home",
  created() {
    console.log(this.$store.commit);
  },
  computed: {
    ...mapGetters('test', ['newName']),
    ...mapGetters({
      num: 'newNum'
    }),
    ...mapState({
      myNum: 'num'
    }),
    ...mapState('test', ['name'])
  },
  methods: {
    ...mapActions('test', ['_async_set_name']),
    ...mapMutations('test', ['SET_NAME']),
    handlerAdd() {
      bigDecimal.add(0.9, 0.289);
    },
    handleClick() {
      this.$store.state.num++;
    },
    handlerAsyncClick() {
      this._async_set_name('wamgkai').then((data) => {
        console.log(data, 'async');
      }).catch(err => {
        console.log(err);
      })
    },
    handlerSubrice() {
      this.SET_NAME('kai.wang');
      this.$store.subscribe((mutations, state) => {
        console.log(mutations.type, mutations.payload, state);
      })
    }
  }
};
</script>
