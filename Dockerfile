# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# package.json ရော package-lock.json ကိုပါ copy ကူးမယ်
# အကယ်၍ package-lock.json မရှိရင် npm install ကို သုံးရပါမယ်
COPY package*.json ./

# package-lock.json မရှိတဲ့ အခြေအနေအတွက် npm install ကို သုံးထားပါတယ်
# အကယ်၍ သင့်မှာ lock file ရှိရင် 'npm ci' ပြန်ပြောင်းသုံးနိုင်ပါတယ်
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Security အတွက် user အသစ် ဆောက်တာ မှန်ပါတယ်
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package*.json ./

# Production အတွက် လိုအပ်တဲ့ library တွေပဲ သွင်းမယ်
# --omit=dev က npm ဗားရှင်းအသစ်တွေမှာ ပိုကောင်းပါတယ်
RUN npm install --omit=dev && npm cache clean --force

# Builder stage ကနေ build ထွက်လာတဲ့ dist folder ကိုပဲ ယူမယ်
COPY --from=builder /app/dist ./dist

# အကယ်၍ public folder ရှိရင် copy ကူးမယ် (မရှိရင် error မတက်အောင် သတိထားပါ)
COPY --from=builder /app/src/public ./dist/public

# Permission ပေးဖို့ လိုအပ်နိုင်ပါတယ်
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

# Server file နာမည်က dist/index.js ဖြစ်နိုင်သလို dist/server.js လည်း ဖြစ်နိုင်ပါတယ်
# သင့် project ရဲ့ entry point အတိုင်း ပြင်ပေးပါ
CMD ["node", "dist/server.js"]
