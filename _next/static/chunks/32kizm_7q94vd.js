(()=>{"use strict";(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,54126,t=>{var e=t.i(81107),a=t.i(27076),f=t.i(65654),r=t.i(22558);let o=class t extends f.f{constructor(e){super(e={...t.defaultOptions,...e}),this.enabled=!0,this._state=r.A.for2d(),this.blendMode=e.blendMode,this.padding=e.padding,"boolean"==typeof e.antialias?this.antialias=e.antialias?"on":"off":this.antialias=e.antialias,this.resolution=e.resolution,this.blendRequired=e.blendRequired,this.clipToViewport=e.clipToViewport,this.addResource("uTexture",0,1),e.blendRequired&&this.addResource("uBackTexture",0,3)}apply(t,e,a,f){t.applyFilter(this,e,a,f)}get blendMode(){return this._state.blendMode}set blendMode(t){this._state.blendMode=t}static from(f){let r,o,{gpu:s,gl:i,...n}=f;return s&&(r=a.f.from(s)),i&&(o=e.f.from(i)),new t({gpuProgram:r,glProgram:o,...n})}};o.defaultOptions={blendMode:"normal",resolution:1,padding:0,antialias:"off",blendRequired:!1,clipToViewport:!0},t.s(["f",0,o])},35066,90532,t=>{let e={name:"local-uniform-bit",vertex:{header:`

            struct LocalUniforms {
                uTransformMatrix:mat3x3<f32>,
                uColor:vec4<f32>,
                uRound:f32,
            }

            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,main:`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,end:`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `}},a={...e,vertex:{...e.vertex,header:e.vertex.header.replace("group(1)","group(2)")}},f={name:"local-uniform-bit",vertex:{header:`

            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,main:`
            vColor *= uColor;
            modelMatrix = uTransformMatrix;
        `,end:`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `}};t.s(["q",0,e,"Y",0,f,"M",0,a],35066);let r={name:"texture-bit",vertex:{header:`

        struct TextureUniforms {
            uTextureMatrix:mat3x3<f32>,
        }

        @group(2) @binding(2) var<uniform> textureUniforms : TextureUniforms;
        `,main:`
            uv = (textureUniforms.uTextureMatrix * vec3(uv, 1.0)).xy;
        `},fragment:{header:`
            @group(2) @binding(0) var uTexture: texture_2d<f32>;
            @group(2) @binding(1) var uSampler: sampler;


        `,main:`
            outColor = textureSample(uTexture, uSampler, vUV);
        `}},o={name:"texture-bit",vertex:{header:`
            uniform mat3 uTextureMatrix;
        `,main:`
            uv = (uTextureMatrix * vec3(uv, 1.0)).xy;
        `},fragment:{header:`
        uniform sampler2D uTexture;


        `,main:`
            outColor = texture(uTexture, vUV);
        `}};t.s(["S",0,r,"X",0,o],90532)},35656,39391,t=>{var e=t.i(85830),a=t.i(46820);t.s(["f",0,function(t,f){for(let a in t.attributes){let r=t.attributes[a],o=f[a];o?(r.format??(r.format=o.format),r.offset??(r.offset=o.offset),r.instance??(r.instance=o.instance)):r.format||(0,e.f)(`Attribute ${a} is not present in the shader, but is present in the geometry. Unable to infer attribute details.`)}!function(t){let{buffers:e,attributes:f}=t,r={},o={};for(let t in e){let a=e[t];r[a.uid]=0,o[a.uid]=0}for(let t in f){let e=f[t];r[e.buffer.uid]+=(0,a.f)(e.format).stride}for(let t in f){let e=f[t];e.stride??(e.stride=r[e.buffer.uid]),e.start??(e.start=o[e.buffer.uid]),o[e.buffer.uid]+=(0,a.f)(e.format).stride}}(t)}],35656);var f=t.i(96108);let r=[];r[f.U.NONE]=void 0,r[f.U.DISABLED]={stencilWriteMask:0,stencilReadMask:0},r[f.U.RENDERING_MASK_ADD]={stencilFront:{compare:"equal",passOp:"increment-clamp"},stencilBack:{compare:"equal",passOp:"increment-clamp"}},r[f.U.RENDERING_MASK_REMOVE]={stencilFront:{compare:"equal",passOp:"decrement-clamp"},stencilBack:{compare:"equal",passOp:"decrement-clamp"}},r[f.U.MASK_ACTIVE]={stencilWriteMask:0,stencilFront:{compare:"equal",passOp:"keep"},stencilBack:{compare:"equal",passOp:"keep"}},r[f.U.INVERSE_MASK_ACTIVE]={stencilWriteMask:0,stencilFront:{compare:"not-equal",passOp:"keep"},stencilBack:{compare:"not-equal",passOp:"keep"}},t.s(["f",0,r],39391)},28353,92715,62039,33156,87784,t=>{var e=t.i(55364),a=t.i(85465),f=t.i(64957);t.s(["f",0,class{constructor(t){this._syncFunctionHash=Object.create(null),this._adaptor=t,this._systemCheck()}_systemCheck(){if(!(0,e.f)())throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.")}ensureUniformGroup(t){let e=this.getUniformGroupData(t);t.buffer||(t.buffer=new a.f({data:new Float32Array(e.layout.size/4),usage:f.f.UNIFORM|f.f.COPY_DST}))}getUniformGroupData(t){return this._syncFunctionHash[t._signature]||this._initUniformGroup(t)}_initUniformGroup(t){let e=t._signature,a=this._syncFunctionHash[e];if(!a){let f=Object.keys(t.uniformStructures).map(e=>t.uniformStructures[e]),r=this._adaptor.createUboElements(f),o=this._generateUboSync(r.uboElements);a=this._syncFunctionHash[e]={layout:r,syncFunction:o}}return this._syncFunctionHash[e]}_generateUboSync(t){return this._adaptor.generateUboSync(t)}syncUniformGroup(t,e,r){let o=this.getUniformGroupData(t);t.buffer||(t.buffer=new a.f({data:new Float32Array(o.layout.size/4),usage:f.f.UNIFORM|f.f.COPY_DST}));let s=null;return e||(e=t.buffer.data,s=t.buffer.dataInt32),r||(r=0),o.syncFunction(t.uniforms,e,s,r),!0}updateUniformGroup(t){if(t.isStatic&&!t._dirtyId)return!1;t._dirtyId=0;let e=this.syncUniformGroup(t);return t.buffer.update(),e}destroy(){this._syncFunctionHash=null}}],28353);let r=[{type:"mat3x3<f32>",test:t=>void 0!==t.value.a,ubo:`
            var matrix = uv[name].toArray(true);
            data[offset] = matrix[0];
            data[offset + 1] = matrix[1];
            data[offset + 2] = matrix[2];
            data[offset + 4] = matrix[3];
            data[offset + 5] = matrix[4];
            data[offset + 6] = matrix[5];
            data[offset + 8] = matrix[6];
            data[offset + 9] = matrix[7];
            data[offset + 10] = matrix[8];
        `,uniform:`
            gl.uniformMatrix3fv(ud[name].location, false, uv[name].toArray(true));
        `},{type:"vec4<f32>",test:t=>"vec4<f32>"===t.type&&1===t.size&&void 0!==t.value.width,ubo:`
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
            data[offset + 2] = v.width;
            data[offset + 3] = v.height;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y || cv[2] !== v.width || cv[3] !== v.height) {
                cv[0] = v.x;
                cv[1] = v.y;
                cv[2] = v.width;
                cv[3] = v.height;
                gl.uniform4f(ud[name].location, v.x, v.y, v.width, v.height);
            }
        `},{type:"vec2<f32>",test:t=>"vec2<f32>"===t.type&&1===t.size&&void 0!==t.value.x,ubo:`
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y) {
                cv[0] = v.x;
                cv[1] = v.y;
                gl.uniform2f(ud[name].location, v.x, v.y);
            }
        `},{type:"vec4<f32>",test:t=>"vec4<f32>"===t.type&&1===t.size&&void 0!==t.value.red,ubo:`
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
            data[offset + 3] = v.alpha;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue || cv[3] !== v.alpha) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                cv[3] = v.alpha;
                gl.uniform4f(ud[name].location, v.red, v.green, v.blue, v.alpha);
            }
        `},{type:"vec3<f32>",test:t=>"vec3<f32>"===t.type&&1===t.size&&void 0!==t.value.red,ubo:`
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
        `,uniform:`
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                gl.uniform3f(ud[name].location, v.red, v.green, v.blue);
            }
        `}];function o(t,e){return`
        for (let i = 0; i < ${t*e}; i++) {
            data[offset + (((i / ${t})|0) * 4) + (i % ${t})] = v[i];
        }
    `}t.s(["f",0,r],92715),t.s(["f",0,function(t,e,a){let f=[`
        var v = null;
        var v2 = null;
        var t = 0;
        var index = 0;
        var name = null;
        var arrayOffset = null;
    `],o=0;for(let s=0;s<t.length;s++){let i=t[s],n=i.data.name,u=!1,v=0;for(let t=0;t<r.length;t++)if(r[t].test(i.data)){v=i.offset/4,f.push(`name = "${n}";`,`offset += ${v-o};`,r[t].ubo),u=!0;break}if(!u)if(i.data.size>1)v=i.offset/4,f.push(a(i,v-o));else{let t=e[i.data.type];v=i.offset/4,f.push(`
                    v = uv.${n};
                    offset += ${v-o};
                    ${t};
                `)}o=v}return Function("uv","data","dataInt32","offset",f.join("\n"))}],62039);let s={f32:`
        data[offset] = v;`,i32:`
        dataInt32[offset] = v;`,u32:`
        dataInt32[offset] = v;`,"vec2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];`,"vec3<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];`,"vec4<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];`,"vec2<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];`,"vec3<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];`,"vec4<i32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];
        dataInt32[offset + 3] = v[3];`,"vec2<u32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];`,"vec3<u32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];`,"vec4<u32>":`
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];
        dataInt32[offset + 3] = v[3];`,"mat2x2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 4] = v[2];
        data[offset + 5] = v[3];`,"mat3x3<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 4] = v[3];
        data[offset + 5] = v[4];
        data[offset + 6] = v[5];
        data[offset + 8] = v[6];
        data[offset + 9] = v[7];
        data[offset + 10] = v[8];`,"mat4x4<f32>":`
        for (let i = 0; i < 16; i++) {
            data[offset + i] = v[i];
        }`,"mat3x2<f32>":o(3,2),"mat4x2<f32>":o(4,2),"mat2x3<f32>":o(2,3),"mat4x3<f32>":o(4,3),"mat2x4<f32>":o(2,4),"mat3x4<f32>":o(3,4)},i={...s,"mat2x2<f32>":`
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];
    `};t.s(["E",0,s,"c",0,i],33156);var n=t.i(95932),u=t.i(24314);class v extends n.f{constructor({buffer:t,offset:e,size:a}){super(),this.uid=(0,u.f)("buffer"),this._resourceType="bufferResource",this._resourceId=(0,u.f)("resource"),this._bufferResource=!0,this.destroyed=!1,this.buffer=t,this.offset=0|e,this.size=a,this.buffer.on("change",this.onBufferChange,this)}get _gcLastUsed(){return this.buffer?._gcLastUsed??-1}set _gcLastUsed(t){this.buffer&&(this.buffer._gcLastUsed=t)}onBufferChange(){this._resourceId=(0,u.f)("resource"),this.emit("change",this)}destroy(t=!1){this.destroyed=!0,t&&this.buffer.destroy(),this.emit("change",this),this.buffer=null,this.removeAllListeners()}}t.s(["f",0,v],87784)},87567,t=>{t.s(["f",0,function(t,e,a,f,r){if((t=Math.max(0,t))>=(e=Math.min(e,a*f)))return 0;let o=Math.floor(t/a),s=t-o*a,i=Math.floor(e/a),n=e-i*a;if(o===i)return r[0].set(s,o,n-s,1),1;let u=0,v=o;return s>0&&(r[u++].set(s,o,a-s,1),v++),i>v&&r[u++].set(0,v,a,i-v),n>0&&r[u++].set(0,i,n,1),u}])}])})();