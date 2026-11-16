"""离线复现本篇四张数据图与统计摘要。

用法：python generate_charts.py [--csv snapshot_summary.csv]
依赖：matplotlib、numpy；中文字体优先使用微软雅黑或 Noto Sans CJK SC。
时间均为北京时间。只读本地 CSV 与人工核对的终局账本，不联网。
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import Counter
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.dates as mdates
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import numpy as np

BASE = Path(__file__).resolve().parent
COLORS = ['#087f8c', '#e09b24', '#5268bc', '#ab65a5', '#5d8c5d', '#748196', '#d05654']
INK, MUTED, GRID = '#243449', '#607086', '#e5ebf0'


def setup():
    for name in ['Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'SimHei', 'Droid Sans Fallback']:
        if any(f.name == name for f in fm.fontManager.ttflist):
            plt.rcParams['font.family'] = name
            break
    else:
        raise RuntimeError('请安装微软雅黑或 Noto Sans CJK SC 中文字体。')
    plt.rcParams.update({'figure.facecolor':'white', 'axes.facecolor':'white',
                         'font.size':11, 'axes.labelcolor':INK, 'text.color':INK,
                         'xtick.color':MUTED, 'ytick.color':MUTED,
                         'axes.unicode_minus':False, 'savefig.facecolor':'white'})


def polish(ax, axis='y'):
    ax.spines[['top','right']].set_visible(False)
    ax.spines[['left','bottom']].set_color(GRID)
    ax.grid(axis=axis, color=GRID, lw=.8, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, pad=7)


def save(fig, name):
    fig.savefig(BASE / name, dpi=220, bbox_inches='tight', pad_inches=.22)
    plt.close(fig)


def load_rows(path):
    rows=list(csv.DictReader(path.open(encoding='utf-8-sig',newline='')))
    valid=[r for r in rows if r['当轮数据有效']=='是']
    return rows,valid


def dt(s):
    return datetime.fromisoformat(s.replace(' +08:00',''))


def correlation(x,y):
    return float(np.corrcoef(x,y)[0,1])


def timeline(bids):
    colors={name:COLORS[i] for i,name in enumerate(dict.fromkeys(b['bidder'] for b in bids))}
    end=dt('2026-11-16 21:26:34'); original=dt('2026-11-16 21:15:04')
    times=[dt(b['time']) for b in bids];prices=[b['price'] for b in bids]
    fig,(a,z)=plt.subplots(2,1,figsize=(13.8,10.2),gridspec_kw={'height_ratios':[1,1.15]})
    fig.subplots_adjust(hspace=.52,top=.88,bottom=.08,left=.075,right=.97)
    fig.suptitle('aee.cc：28 笔账本，最后一手没有点',x=.075,y=.975,ha='left',fontsize=22,weight='bold')
    fig.text(.075,.933,'7 条底价初始化 + 21 条后续出价记录（含 2 条代理出价）｜2026-11-13—11-16',color=MUTED,fontsize=12)
    for ax in (a,z):
        ax.step(times+[end],prices+[300],where='post',color='#aab8c9',lw=1.8,zorder=2)
        ax.axhline(220,color='#cf5250',ls=(0,(5,3)),lw=1.3)
        ax.set_ylabel('领先价格 / 元')
        polish(ax)
    for name,color in colors.items():
        bb=[b for b in bids if b['bidder']==name]
        for ax in (a,z):
            ax.scatter([dt(b['time']) for b in bb],[b['price'] for b in bb],s=40,color=color,edgecolor='white',lw=.7,zorder=4)
    a.set_title('全周期：前程交锋后，¥210 横盘 54 小时 43 分 49 秒',loc='left',fontsize=13,pad=17,weight='bold')
    a.set_ylim(75,325); a.set_xlim(times[0],end)
    a.xaxis.set_major_locator(mdates.HourLocator(interval=12))
    a.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d\n%H:%M'))
    a.axvspan(dt('2026-11-14 14:22:38'),dt('2026-11-16 21:06:27'),color='#eef5f5',zorder=0)
    a.text(dt('2026-11-15 05:00:00'),140,'长时间无人加价\n领先者：mwc11psp',fontsize=12,color='#387d84')
    a.annotate('7 条初始化记录\n同秒、同价 ¥99',xy=(times[0],99),xytext=(18,35),textcoords='offset points',fontsize=10,arrowprops={'arrowstyle':'-','color':MUTED})
    a.text(.985,.64,'本人出价上限 ¥220',transform=a.transAxes,ha='right',color='#bc4543',fontsize=10)
    handles=[Line2D([0],[0],marker='o',color='white',markerfacecolor=c,markersize=6,label=n) for n,c in colors.items()]
    a.legend(handles=handles,loc='upper left',bbox_to_anchor=(0,1.02),ncol=4,fontsize=8.5,frameon=False,columnspacing=1.3)
    z.set_title('终局放大：21:05 至 21:26:34，时间精确到秒',loc='left',fontsize=13,pad=17,weight='bold')
    z.set_xlim(dt('2026-11-16 21:05:00'),dt('2026-11-16 21:27:00'));z.set_ylim(202,326)
    z.xaxis.set_major_locator(mdates.MinuteLocator(interval=2));z.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    z.axvline(original,color='#8898aa',ls=':',lw=1.2)
    z.axvline(end,color=INK,ls=':',lw=1.2)
    z.text(original,324,'原定截止\n21:15:04',ha='right',va='top',fontsize=9,color=MUTED)
    z.text(end,324,'落槌\n21:26:34',ha='right',va='top',fontsize=9)
    last=bids[-9:]
    offsets=[(0,20),(-12,-24),(2,17),(-8,-25),(10,17),(-20,-28),(-28,23),(30,15),(12,20)]
    for b,(ox,oy) in zip(last,offsets):
        z.annotate(f"¥{b['price']}\n{b['time'][-8:]}",xy=(dt(b['time']),b['price']),xytext=(ox,oy),textcoords='offset points',fontsize=8.8,ha='center',color=colors[b['bidder']],arrowprops={'arrowstyle':'-','color':colors[b['bidder']],'lw':.7})
    z.text(.02,.97,'蓝绿：mweycvbn（外部出价）   金色：mweql2os',transform=z.transAxes,va='top',fontsize=10)
    z.text(.02,.03,'21:06:27 对手先报 ¥220 → 下一手 ¥230 + ¥80 = ¥310，取消出价计划',transform=z.transAxes,color='#b34845',fontsize=10)
    fig.text(.075,.012,'数据：用户保存的终局完整流水。初始化记录同秒重叠；完整 28 行见正文账本。',fontsize=10,color=MUTED)
    save(fig,'aee_cc_bidding_timeline.png')


def matrix(valid,bids):
    domains=['mzzi.com','mmmv.com','aee.cc','fcc.top','zms.cc','0706.net','wrz.cc','21435.com']
    data=[]
    for d in domains:
        rr=[r for r in valid if r['域名']==d and 'auctioning' in r['当前状态']]
        r=rr[-1]
        people=int(r['参拍人数']);count=int(r['出价次数']);price=int(r['当前价格']);label='末次有效预估价'
        if d=='aee.cc': count=len(bids);price=bids[-1]['price'];label='终局成交价'
        comparison_at='2026-11-16 21:26:34 +08:00' if d=='aee.cc' else r['检测时间']
        data.append({'domain':d,'people':people,'bids':count,'net':count-people,'price':price,'basis':label,
                     'comparison_at':comparison_at,'csv_last_valid_at':r['检测时间']})
    fig,(l,r)=plt.subplots(1,2,figsize=(13.5,6.8),sharey=True,gridspec_kw={'width_ratios':[1,1.2]})
    fig.subplots_adjust(wspace=.12,top=.80,bottom=.20,left=.12,right=.97)
    fig.suptitle('热拍盘与底价盘，隔着多少次加价？',x=.12,y=.975,ha='left',fontsize=22,weight='bold')
    fig.text(.12,.91,'8 个进入过竞价期的样本｜aee.cc 使用晚间终局，其余取各自末次有效快照',color=MUTED,fontsize=11)
    ys=np.arange(8);cc=['#637db3' if x['domain'].endswith('.com') else '#16878d' for x in data];cc[2]='#d4872a'
    l.barh(ys,[x['net'] for x in data],color=cc,height=.56,zorder=3)
    l.set_yticks(ys,domains);l.invert_yaxis();l.set_xlim(0,70);l.set_xlabel('净主动博弈记录 Δ = 出价次数 − 参拍人数')
    l.set_title('额外记录数（含代理出价）',loc='left',pad=18,fontsize=12,weight='bold')
    for y,x in zip(ys,data): l.text(x['net']+1,y,str(x['net']),va='center',fontsize=12,weight='bold')
    r.barh(ys,[x['price'] for x in data],color=cc,height=.56,zorder=3)
    r.set_xlim(0,4250);r.set_xlabel('价格 / 元（未含转入、续费）');r.tick_params(labelleft=False)
    r.set_title('价格口径逐项标明',loc='left',pad=18,fontsize=12,weight='bold')
    for y,x in zip(ys,data):
        basis='成交' if x['domain']=='aee.cc' else '预估'
        r.text(x['price']+45,y,f"¥{x['price']:,}  {basis}",va='center',fontsize=10)
    for ax in (l,r):polish(ax,'x')
    fig.text(.12,.09,'注意：参考域名缺少终局交易账本；¥99、¥109 为观测价格，不能据此确认成交或交割。',fontsize=10,color=MUTED)
    fig.text(.12,.045,'CSV 截至 2026-11-16 16:31:29；每个参考标的采用「当轮数据有效 = 是」的最后记录。',fontsize=10,color=MUTED)
    save(fig,'domain_matrix_comparison.png')
    return data


def distribution(valid):
    values=[int(r['原始bookNum（疑似随机数）']) for r in valid]
    counts=Counter(values);mean=statistics.mean(values);sd=statistics.stdev(values);lag=correlation(values[:-1],values[1:])
    fig,ax=plt.subplots(figsize=(13,5.9));fig.subplots_adjust(top=.77,bottom=.20,left=.08,right=.97)
    fig.suptitle('bookNum 看起来更像噪声，而不是预订人数',x=.08,y=.98,ha='left',fontsize=21,weight='bold')
    fig.text(.08,.90,f'{len(values):,} 条有效记录｜均值 {mean:.2f}｜样本标准差 {sd:.2f}｜混排一阶相关 {lag:.4f}',fontsize=12,color=MUTED)
    ax.bar(range(1,51),[counts[n] for n in range(1,51)],width=.75,color='#5f9da5',zorder=3)
    ax.axhline(len(values)/50,color='#d49b32',ls='--',lw=1.5,label=f'均匀分布理论频数：{len(values)/50:.2f} / 桶')
    ax.axvline(25.5,color='#b45e72',ls=':',lw=1.6,label='离散 U(1, 50) 理论均值：25.50')
    ax.set_xlim(.1,50.9);ax.set_ylim(0,70);ax.set_xticks([1,5,10,15,20,25,30,35,40,45,50])
    ax.set_xlabel('公开接口原始 bookNum');ax.set_ylabel('记录数');polish(ax)
    ax.legend(loc='upper left',fontsize=10,frameon=False,ncol=2)
    fig.text(.08,.09,'理论标准差 14.43；原值均在 1—50。横轴为离散整数，每个整数单独计数。',fontsize=10,color=MUTED)
    fig.text(.08,.04,'分布与均匀随机数相符；统计吻合不等于取得服务端随机算法。原字段继续标注「疑似随机数」。',fontsize=10,color=MUTED)
    save(fig,'booknum_uniform_distribution.png')
    return {'n':len(values),'min':min(values),'max':max(values),'mean':mean,'sample_sd':sd,'pooled_lag1':lag,'counts':dict(sorted(counts.items()))}


def sawtooth(valid):
    rows=[r for r in valid if r['域名']=='mmmv.com' and 'auctioning' in r['当前状态']]
    pts=[];prev=None
    for r in rows:
        k=(r['当前价格'],r['出价次数'])
        if k!=prev:pts.append(r);prev=k
    fig,(a,b)=plt.subplots(2,1,figsize=(13.4,8.4),gridspec_kw={'height_ratios':[1.15,1]},sharex=True)
    fig.subplots_adjust(hspace=.30,top=.83,bottom=.18,left=.09,right=.97)
    fig.suptitle('mmmv.com：出价次数增加，公开价格却会回落',x=.09,y=.975,ha='left',fontsize=21,weight='bold')
    fig.text(.09,.91,'上：外显预估价；下：累计出价次数。只画实测值，不反推未经验证的真实价或折算公式。',fontsize=11,color=MUTED)
    times=[dt(x['检测时间']) for x in pts];prices=[int(x['当前价格']) for x in pts];counts=[int(x['出价次数']) for x in pts]
    end=dt(rows[-1]['检测时间'])
    a.step(times+[end],prices+[prices[-1]],where='post',lw=2,color='#178c95');a.scatter(times,prices,color='#178c95',s=38,zorder=3)
    b.step(times+[end],counts+[counts[-1]],where='post',lw=2,color='#7788b7');b.scatter(times,counts,color='#7788b7',s=32,zorder=3)
    a.set_ylabel('公开预估价 / 元');b.set_ylabel('出价次数');a.set_ylim(0,3400);b.set_ylim(27,59)
    for ax in (a,b):polish(ax)
    a.annotate('¥1,900 → ¥1,890\n42 → 43 次',xy=(times[2],prices[2]),xytext=(25,-73),textcoords='offset points',fontsize=10,arrowprops={'arrowstyle':'->','color':MUTED})
    a.annotate('¥2,800 → ¥2,610',xy=(times[6],prices[6]),xytext=(-15,-55),textcoords='offset points',fontsize=10,arrowprops={'arrowstyle':'->','color':MUTED})
    a.annotate('¥3,000 → ¥2,800',xy=(times[8],prices[8]),xytext=(-75,-65),textcoords='offset points',fontsize=10,arrowprops={'arrowstyle':'->','color':MUTED})
    a.annotate('13:02:09 回升至 ¥2,900\n出价仍是 55 次',xy=(times[-1],prices[-1]),xytext=(-14,33),textcoords='offset points',fontsize=10,ha='right',color='#bd7c20',arrowprops={'arrowstyle':'->','color':'#bd7c20'})
    b.axvspan(times[-2],end,color='#fff5df',zorder=0)
    b.text(times[-2],57,'  55 次保持不变，预估价仍变化',fontsize=10,color='#a8792d')
    b.xaxis.set_major_locator(mdates.HourLocator(interval=6));b.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d\n%H:%M'))
    fig.text(.09,.075,'时间为首次观测到变化的巡检检测时间，不是实际出价时间。数据只保留当轮有效记录。',fontsize=10,color=MUTED)
    fig.text(.09,.025,'数据：snapshot_summary.csv。末次有效记录 2026-11-16 16:02:04；该域名当时尚未结标。',fontsize=10,color=MUTED)
    save(fig,'mmmv_price_sawtooth.png')
    return [{k:r[k] for k in ['检测时间','当前价格','参拍人数','出价次数']} for r in pts]


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--csv',type=Path,default=BASE/'snapshot_summary.csv');args=parser.parse_args()
    setup();rows,valid=load_rows(args.csv);bids=json.loads((BASE/'aee_bid_ledger.json').read_text(encoding='utf-8'))
    assert len(bids)==28 and len(set(b['bidder'] for b in bids))==7
    assert sum(b['kind']=='初始化' for b in bids)==7 and sum(b['kind']=='代理出价' for b in bids)==2
    assert all(dt(a['time'])<=dt(b['time']) for a,b in zip(bids,bids[1:]))
    timeline(bids)
    result={'records':len(rows),'rounds':len(set(r['巡检编号'] for r in rows)),'valid_records':len(valid),'valid_percent':100*len(valid)/len(rows),
            'start':min(r['检测时间'] for r in rows),'end':max(r['检测时间'] for r in rows),
            'matrix':matrix(valid,bids),'booknum':distribution(valid),'mmmv_changes':sawtooth(valid),
            'ledger':{'records':len(bids),'participants':7,'post_initial_records':21,'proxy_records':2,'final_price':300,'transfer_renewal_cost':80,
                      'original_end':'2026-11-16 21:15:04','final_end':'2026-11-16 21:26:34','extension_seconds':690,'quiet_seconds':int((dt(bids[19]['time'])-dt(bids[18]['time'])).total_seconds())}}
    (BASE/'chart_statistics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('matrix','booknum','mmmv_changes')},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
