/*global globals, $, _ */

_.deepClone = function (val) {
  return JSON.parse(JSON.stringify(val));
};

const ajax = (function () {
  var request = function (action, method, data) {
    if (
      data &&
      (method === "PUT" || method === "POST" || method === "DELETE")
    ) {
      data = JSON.stringify(data);
    }

    return $.ajax({
      url: action,
      method: method,
      type: method,
      data: data,
      dataType: "json",
      cache: false,
      contentType: "application/json; charset=UTF-8"
    });
  };

  return {
    get: function (action, data) {
      return request(action, "GET", data);
    },
    post: function (action, data) {
      return request(action, "POST", data);
    },
    put: function (action, data) {
      return request(action, "PUT", data);
    },
    delete: function (action, data) {
      return request(action, "DELETE", data);
    }
  };
})();

//
new Vue({
  el: "#app",
  data() {
    return {
      state: {
        page: "index"
      },
      data: ""
    };
  },
  watch: {},
  computed: {},
  created() {},
  mounted() {},
  methods: {
    post() {
      ajax
        .post("/api/echo", {})
        .done(
          function (data) {
            this.data = data;
          }.bind(this)
        )
        .fail(
          function (err) {
            this.state.errors.global = "Failed to post to webhook endpoint.";
          }.bind(this)
        );
    }
  }
});
