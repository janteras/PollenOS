# Abstract 

This whitepaper will provide insight into how the Pollen protocol functions on a technical 

level while introducing new features unique to the Pollen governance model. We aim to 

showcase the Pollen governance model, protocol, its design function, and the mathematics 

employed. We introduce new concepts and incentive layers for both investors and liquidity 

providers (LP's). 

# Disclaimer 

All of the information presented in this whitepaper is tentative and is subject to change at any 

time. None of the information herein should be construed as legal, accounting, or investment 

advice of any kind. This document does not represent a solicitation for investment, nor does 

it represent an offering or sale, public or private, of any kind of financial instrument, security 

or otherwise, in any jurisdiction. This whitepaper is provided for informational purposes only, 

with the intention to describe Pollen’s prospective protocol and governance model. Introduction 

PLN Token Dynamics: Governance and Rewards 

Product Roadmap 

Pollen Virtual 

Virtual Portfolios 

Theoretical Description 

Onchain Return Calculation 

Market Benchmark 

Rewards 

Reputation 

PollenSkill 

In-depth look and methodology 

Delegation 

Pollen Leagues PRO 

Pollen CryptoBowl 

PLN Tokenomics 

Supply control 

Issuance Curve 

Governance 

Governance Architecture 

Rewards 

Voting Rights 

Conclusion Introduction 

Pollen is a decentralized prediction market and DAO that includes the Pollen Virtual Trading 

Arena and CryptoBowl Trading Tournaments platform. As part of its ecosystem on 

Avalanche, Base, and Polygon, Pollen introduces two key assets: the PLN utility token and 

the vote-escrowed vePLN governance token. 

Pollen Virtual enables a risk-free environment for honing trading skills, joining communities 

through Leagues PRO, and competing in CryptoBowl tournaments. Here, users build virtual 

portfolios that generate signals to inform Pollen’s prediction market and reward top 

contributors through reputation and rebalancing algorithms 

PLN token holders can manage or delegate virtual portfolios, earning rewards and 

participating in Pollen DAO governance. By locking PLN in exchange for vePLN, users 

access boosted rewards from a 20 million PLN reward pool over the first 1406 days, 

encouraging long-term holding and engagement. 

Pollen introduces a competitive edge to prediction markets with Pollen Leagues PRO which 

is a tailored solution for organizations & businesses, enabling them to set up and manage 

their own communities on the Pollen platform. 

Pollen’s open protocol combines a merit-based system and decentralized governance to 

reward community-driven insights and top performers. This system uses the crowd’s 

intelligence to drive asset management and inform prediction market data. 

Virtual portfolios represent a collection of ‘virtual allocations. That is, a user decides what 

assets should be included in their virtual portfolios and their corresponding allocation 

weights. These provide signals to inform our prediction market via reward, reputation, and 

rebalancing algorithms. 

The protocol’s reputation algorithm identifies the best performers and uses this information 

to award PLN governance tokens and inform delegation decisions. 

By fully decentralising governance and introducing a merit-based reputation and rewards 

system, the platform crowdsources market intelligence to produce open prediction market 

data. 

# PLN Token Dynamics: Governance and Rewards 

PLN token holders have extensive privileges within the Pollen ecosystem, allowing them to 

create, manage, and delegate virtual portfolios while actively participating in the governance 

of the Pollen DAO. Locking PLN tokens in exchange for vePLN tokens enables users to earn 

enhanced rewards and access a 20 million PLN reward pool over the first 1406 days. This 

approach incentivizes long-term commitment while promoting sustainable growth within the 

ecosystem. Figure 1: Pollen Virtual schematic description. The Pollen Community uses the PLN token to manage 

> virtual portfolios, to delegate to top performers and to govern the protocol through the Pollen DAO.

Pollen’s protocol harvests collective intelligence through its merit-based system, rewarding 

top contributors and enabling community-driven asset management. Participants use PLN 

tokens to create virtual portfolios exposed to real asset prices. A reputation algorithm further 

identifies top-performing portfolios, influencing asset pool allocations, optimizing the 

delegation process, and distributing PLN tokens to high-performing community members. Product Roadmap 

Pollen Virtual: A merit-based trading arena supporting long and short positions, rewarding 

contributors for accurate market predictions. Future improvements include expanded asset 

support and updated tokenomics to enhance user engagement.. 

Pollen Leagues PRO: Leagues PRO is tailored for organizations & businesses, and 

provides a customised experience and features multiple revenue-generation models. 

Organizations can leverage Leagues PRO to host and manage customized trading 

competitions directly on the Pollen platform. 

CryptoBowl: The CryptoBowl introduces a competitive edge to Pollen Virtual, enabling 

Leagues PRO organizations to participate in fully on-chain trading tournaments. This 

platform supports community growth, fosters engagement, and provides multiple revenue 

streams for participating leagues. 

Pollen DAO: Pollen operates as a DAO with a customized protocol that self-executes 

community-approved proposals without centralized intervention. This decentralized 

governance model empowers the community to shape Pollen’s future, and ensures that the 

community remains in control. 

Cross-Chain: Pollen is implementing a cross-chain Layer-Zero solution currently in Beta, 

supporting Avalanche and Base networks, with planned integration for Polygon in Q3 2025. 

Prediction Market: Pollen is expanding its prediction market capabilities, supported by 

protocol updates to reduce friction and enhance incentives for both novice and experienced 

traders. An API will also be introduced to make prediction market data more accessible to 

consumers and external platforms. Pollen Virtual 

# Virtual Portfolios 

Users allocate PLN tokens to virtual portfolios, choosing assets and allocation weights. 

Portfolios can be rebalanced anytime, with rewards or penalties calculated based on 

portfolio performance at closing. Positive performance yields PLN rewards and reputation 

growth, while underperformance results in penalties and reduced reputation. 

Figure 2. Dynamics of Virtual portfolios - Users open virtual portfolios by selecting a collection of 

tokens and their respective weights. Both long and short positions are accepted. The virtual portfolio 

starts with an initial value X. This changes over time as the market prices of the selected tokens 

change. When the User decides to rebalance or close the virtual portfolio, valued at Y, the virtual 

return is computed as (Y-X)/X. This is used to calculate rewards in PLN and update reputation. User 

skill levels are measured by returns using market prices without actually being exposed to the 

underlying assets. Theoretical Description 

Let be the set of the crypto assets supported by Pollen. The assets are 𝑆 = 𝑎 1, 𝑎 2, ..., 𝑎 𝑁 { } 𝑁 

represented by and are fully characterised by the evolution over time of their price 𝑎 𝑖 𝑃 𝑖 (𝑡) 

and associated base currency, e.g. ETH or USD. We assume that the time-series is 𝑃 𝑖 (𝑡) 

known at discrete samples of time. The interval can be either 1 minute, or 1 hour, or 1 day, 

or 1 week, etc, but not necessarily equally spaced. 

Let ) denote the one-period return of the asset between the instants and :𝑅 𝑖 (𝑡 𝑘 𝑎 𝑖 𝑡 𝑘−1 𝑡 𝑘 

A User is characterised by: 𝑈 

● an initial amount PLN that they want to invest into the family of assets .𝑉 𝑈 (𝑡 0) 𝑆 

● a set of weights , such that , 𝑊(𝑡) = 𝑊 𝑈 (𝑡) = 𝑤 1(𝑡), 𝑤 2(𝑡), ..., 𝑤 𝑁 (𝑡) { }

that distributes the amount over each asset 𝑤 𝑖 (𝑡) ∈ [− 1, 1] 𝑉 𝑈 (𝑡 0)

In this context, is said the weight of the asset in the user portfolio at time . We 𝑤 𝑖 (𝑡 𝑘 ) 𝑎 𝑖 𝑈 𝑡 𝑘 

require 

Note that weights are allowed to take negative values. This is equivalent to entering short 

positions in the asset i. The condition that the sum of the absolute weights has to be 1 

models a short position through collateralization. 

This is somewhat similar to the mechanisms applied by established lending platforms. In our 

specific case, the collateralization rate is 1. 

The return of the portfolio is the weighted sum of each asset return scaled by 𝑅 𝑈 (𝑡 𝑘 ) 𝑈 𝑅 𝑖 (𝑡 𝑘 )

their contribution into the portfolio: 𝑤 𝑖 (𝑡 𝑘 )

The value of the User’s portfolio at time is given by 𝑡 𝑘 

Users must stake PLN when creating a virtual portfolio and then can amend their staked 

amount each time they modify their asset allocations. Onchain Return Calculation 

In order to implement the calculation of the return on-chain, considerations on fees and 

efficiency should be taken into consideration: 

● The initial value of the portfolio ( ) is equal to the number of Pollen tokens used to 𝑃𝑉 𝑜 

open the portfolio times the value of each pollen. When the portfolio is open, the 

number of coins of each asset is calculated and stored as: 

Where denotes the time at which the portfolio was open. is the number of coins 𝑡 𝑜 𝐶 𝑖 

of the asset , is the amount of pollen assigned to asset , is the price in USD 𝑖 𝑤 𝑖 𝑁 𝑝 𝑖 𝑃 𝑝 

for one Pollen and is the price of asset in USD. 𝐴𝑃 𝑖 𝑖 

● The final value of the portfolio is calculated as: 

● Return is then calculated as: 

This means that instead of saving the number of coins, it is enough to save the value 

for each asset in the portfolio, in order to calculate the return. (𝑤 𝑖 /𝐴𝑃 𝑖 (𝑡 𝑜 )Market Benchmark 

The section above compares a virtual portfolio with a market benchmark, for example, a 

market benchmark constructed by market capitalization selects the Top 30 or Top 50 assets, 

and defines their weights based on their participation in the total market capitalization of 

selected assets (e.g., S&P 500, DJIA, CCi30, etc.). 

Pollen defines a custom market benchmark because the universe of tokens in which 

Pollenators can express market sentiment is restricted. 

Therefore, a custom benchmark that considers market capitalization, token availability (e.g., 

through a wrapped version), and transaction costs is defined. The latter is needed because, 

whenever the Pollenator rebalances, the smart-contracts need to collect and store additional 

information to compute the entry/exit positions in the market benchmark and provide an 

accurate description of a Pollenator reward and skill. 

The CCi30 benchmark is used as a reference for the global cryptocurrency market 

benchmark. Given that Pollen’s community opted for an initial deployment in the Avalanche 

blockchain, the following tokens satisfy the conditions mentioned above: WBTC, WETH, 

AVAX, BNB and LINK. The objective is to form Pollen’s benchmark as a weighted average of 

these five tokens (or any subset of them) such that the correlation with the broader market is 

maximized and transaction costs are minimized. 

Pollen’s market benchmark will be reassessed as the platform is deployed in other 

blockchains or considerably changes the supported tokens. This is required to provide an 

accurate representation of the market and make sure the value that Pollenators are creating 

is being fairfully measured and rewarded. 

# Rewards 

Rewards are shared in the protocol’s native PLN token with users that have positive virtual 

returns. The rewards shared are proportional to the virtual returns and the staked PLN 

tokens in users’ virtual portfolios. The amount of rewards shared will vary depending on the 

current state of the community market and the available funds in the protocol’s rewards pool. 

In periods where the average performance is low, the best performers are incentivized with 

higher reward amounts, while in market upturns, rewards generated are more conservative. 

# Reputation 

Reputation measures the ability of a user to make sound delegation decisions that are 

reflected in the returns awarded from their virtual portfolios. In order to avoid confounding 

variables due to differences in the amount of PLN that users stake, the reputation scores are 

defined as the compounded return assuming an initial stake of 1 PLN in each virtual 

portfolio. This makes the score insensitive to the amount of PLN staked and provides at any point in 

time an indication of how much value a particular user has been able to generate by adeptly 

managing their virtual portfolios. 

The reputation score can be expressed as: 

𝑅𝑆 = 𝑖=1 𝑛 

∏ 1 + (𝑅(𝑡 𝑖 ) − 𝑅 𝑚 (𝑡 𝑖 )) [ ]

Where R(t) is the portfolio's return at each event of rebalancing the portfolio, Rm(t) is the 

return of the market benchmark (e.g. CCi30 or CRIX), and n is the total number of 

rebalancing events of the user portfolio. Reputation measures, therefore, the user's ability to 

outperform the market. The quantity R(t)-Rm(t) is known as excess return . Data is emitted 

from smart contract events, and the calculations are executed off-chain. 

Additional information regarding the average amount of PLN staked in a virtual portfolio, the 

amount of PLN awarded, and the amount delegated is provided to the user, enabling them to 

make informed delegation decisions. 

As an example of how the protocol calculates reputation, assume a user joins the platform 

on 2021-12-28, they acquire PLN and select the following three tokens: AVAX, BTC, and 

ETH. The initial allocation of the virtual portfolio is 50% into AVAX, 30% into BTC, and 20% 

into ETH, with assets priced at approximately $107, $47588, and $3800, respectively. 

The table below shows the reallocations performed by this fictitious user (who is assumed to 

rebalance daily) from 2021-12-28 until 2022-01-03. 

> Figure 3: Rebalances of a fictitious user - This user is assumed to change its virtual allocations on a
> daily basis.

The Figure below shows the (actual) daily returns of the assets in USD over the same 

period. This example considers CCi30 as the market benchmark. 

> Figure 4: Performance of virtual portfolio composition and market benchmark.

User reputation is calculated using a two-step process: computation of the virtual portfolio 

return and the market benchmark return (both at the time of rebalancing). 

The virtual portfolio return is computed by the weighted average of the assets returns (see 

Virtual Portfolios section for details). 

The excess return is the difference between the virtual portfolio return and the market 

benchmark return. 

The figure below compares the virtual portfolio return (in red) with the market benchmark 

return (in yellow) - each daily, which is assumed to coincide with the event of rebalancing for 

the sake of simplicity (see the Onchain Return Calculation section for details). 

The dusty red areas highlight the periods when the virtual portfolio outperforms the market, 

and therefore the user reputation increases in this period. The user reputation decreases in 

the slate grey areas because the virtual portfolio return is below market benchmark return. Figure 5. Performance of the aggregated virtual portfolio against the market benchmark. Dark regions 

depict periods in which the market benchmark performed better than the virtual portfolio. The 

reputation score of the user decreases in these periods. Conversely, light regions depict periods in 

which the virtual portfolio outperformed the market benchmark. The reputation score of the user 

increases in these periods. 

Reputation is computed by compounding the initial amount of one PLN token by the excess 

return whenever the user rebalances his virtual portfolio. The table below shows the 

reputation per date (i.e., rebalancing events) and how it was computed. 

Table 1. Evolution of the reputation score for a fictitious user. The percentage values in the compounding 

column come from the difference between the virtual portfolio performance against the market benchmark 

over the same period. Positive values indicate that the virtual portfolio beat the market benchmark. Cross Chain and LayerZero 

Figure 6: Diagram that shows how PLN is transferred from Avalanche to Polygon. 

The Cross Chain bridge is implemented as a standard PollenDAO module. It has the ability 

to mint or burn Pollen tokens. 

When a user signs a transaction ordering tokens to be transferred, the tokens are burnt on 

Avalanche, and the Bridge leveraging Layer0 infrastructure sends a message containing the 

amount transferred to its equivalent on the Polygon network. Upon receiving the message 

Polygon Bridge mints the equivalent. PollenSkill 

The PollenSkill algorithm estimates the trading skill of players through the use of Bayesian 

inference. 

The algorithm assumes that trading skill follows a normal distribution. The skill of a user is 

updated whenever they rebalance. This creates an interesting dynamic, as a player's skill is 

described by both a mean and a variance. The more rebalancing a player is doing, the more 

certainty we have around estimating their skill. 

The final score is measured in points that arise as a comparison of a player against all other 

players. This comparison is more impactful when a player's variance is lower. 

Players are incentivized to rebalance when they have positive returns. Therefore, a player 

might forgo rebalancing when experiencing negative returns, to avoid reducing the 

estimation of his skill. However, other players will rebalance more, reducing the estimation 

error of their skill, and accruing more points, as a result. A player who doesn't rebalance 

often, will have his points gravitate towards 0. 

Therefore, the PollenSkill algorithm creates a constant tension between determining how 

other players will perform and forecasting one's portfolio performance. This will lead the 

protocol to a dynamic adaptation, as users adjust their investment styles in order to be able 

to better demonstrate their trading skills. 

The table below shows a high level structure (from a game theoretic perspective) of how the 

system works. The player can find themselves in the following matrix. The notation [x,y] 

means that the player can encounter any range of outcomes. 

The interesting part of this matrix is that waiting yields very uncertain results, due to the 

volatility of the market. Performance in volatile markets is generally seen as a marker of 

trading skill. 

Wait Rebalance 

Negative returns [-3,+1] -1 

Positive returns [-1,+3] +1 In-depth look and methodology 

PollenSkill follows the conjugate Normal-Inverse Gamma model, which estimates the mean 

and the precision (inverse of variance) of the user’s returns simultaneously. 

The new model has the following parameters: 

: The prior mean (expected returns) μ0

: The number of pseudo-observations. This variable represents the number of observations ν

that we assume we have seen before the user actually experiences returns. 

: This is one of the two parameters required by the Gamma distribution α

: The second parameter of the gamma distribution β

The posterior of the model is defined as the NormalGamma distribution. So, we assume that 

𝑠𝑘𝑖𝑙𝑙~𝑁𝑜𝑟𝑚𝑎𝑙𝐺𝑎𝑚𝑚𝑎(μ 0, ν, α, β) 

The final points are calculated as 

𝑝𝑜𝑖𝑛𝑡𝑠 = μ − σ 

Where σ = βν(𝑎−1) 

The update equations are the following: 

μ' = νμ 0+𝑛μ ν+μ 

ν = 𝑛 + ν 

𝑎 = α + 𝑛 2

β = β + 12 Σ(𝑥 − μ) 2 + 𝑛ν 𝑛+ν (𝑥−μ) 2

> 2

And we define as n the new number of observations (real observations, not 

pseudo-observations), as we define the mean of the data (in this case the returns of a μ

player). 

The initial parameters of the model are: 

, we assume that a random user (without knowing anything about them) will have 0% μ0 = 0 

return = 15, this parameter is set to 15 to factor in user portfolio rebalancing into the prediction ν

, parameter set based on observations 𝑎 = 2 

, parameter set based on observations β = 5 

The final interpretation of skill under this model is that it’s the minimum expected return for a 

user with more than 85% probability. 

# Delegation 

In addition to users creating their own virtual portfolios, they also have the option to delegate 

a portion of their PLN tokens to other members of the community (i.e., delegates). Users that 

delegate (i.e., delegators) are then awarded or must forfeit PLN tokens depending on the 

performance of the delegate’s virtual portfolio. 

Delegates receive 20% of the returns generated (subject to change via governance voting), 

providing delegators with a passive yield. Delegators earn rewards when their chosen 

delegates are profitable and forfeit PLN tokens when they perform poorly 

# Pollen Leagues PRO 

Pollen Leagues PRO allows organizations & businesses to create specialized virtual leagues 

with custom token sets and revenue opportunities. Leagues PRO users can build portfolios 

for each league, with the top 10 performers’ reputations determining league standings and 

fostering inter- and intra-league competition. 

Leagues PRO creation is permissioned for quality control, and provides insights on niche 

markets through a diverse asset portfolio, supporting both long and short positions. 

Delegation functionality facilitates knowledge sharing, allowing top performers to mentor 

followers and foster collective intelligence. 

Leagues PRO serves as an accessible revenue-generation and marketing tool, allowing 

projects to harness collective trading intelligence, generate revenue, and reward 

participants. Additionally, communities can incorporate custom branding and advertising 

space on the league homepage, enhancing visibility and providing extra revenue streams. With Leagues PRO, organizations & businesses have exclusive access to the league's 

rankings, market predictions, and top traders, and the ability to purchase top-performing 

assets directly via Pollen and compete against in CryptoBowl Trading tournaments. 

Moreover, they have ongoing rev-gen opportunities from NFT membership sales, and have 

the ability to mint NFT prizes within the platform to engage and reward their communities. Pollen CryptoBowl 

The CryptoBowl is a fully on-chain trading competition platform that can be used standalone 

or within Leagues PRO offering where trading communities can compete head-to-head in a 

showcase of skill, strategy, and performance. Leagues benefit from a community-building 

platform that encourages growth and unlocks multiple revenue streams. With all aspects 

transparent and on-chain—including winner selection—CryptoBowl participants enjoy full 

visibility as they test their skills against opponents. 

CryptoBowl tournaments run in ticketed, three-day cycles, each with a dedicated prize pool, 

ensuring consistent competition entry opportunities. Designed to add a competitive edge, 

CryptoBowl empowers Leagues PRO communities to compete directly, providing dynamic 

ways to interact with the Pollen protocol. PLN Tokenomics 

# Supply control 

Supply control is achieved by an algorithmically defined tracking and virtual issuance 

schedule. 

In periods where rewards minted are low, rewards issuance increases, recalibrating with the 

theoretical issuance schedule. In periods where rewards minted are high, rewards issuance 

decreases to stay in sync with the theoretical issuance schedule. 

Figure 7: Theoretical token supply and expected supply controls curve. After day 1406 the issuance 

schedule will be decided by governance voting. 

Rewards and penalties are adjusted to ensure that Pollen remains competitive within the 

market. For example, it issues more rewards in bullish market conditions and fewer penalties 

in bearish conditions. 

This ensures that the total PLN token supply, capped at 200M for the first 1406 days, is 

never exceeded and helps create a healthy token economy for the protocol. The total supply 

is split into two, 180M is given as rewards to the users for their performance and 20M is 

reserved for locked vePLN rewards. 

An algorithmic procedure that compares the “actual” rewards and penalties runs periodically. 

This algorithm relies on a theoretical minting curve: 𝑀(𝑡) = 94𝑀 + 2. 1004 * 𝑡 * 𝐼 1 + 0. 44505 * 𝑡 * 𝐼 2 + 0. 1348 * 𝑡 * 𝐼 3 + 0. 055 * 𝑡 * 𝐼 4

where, is 1 for year k and 0 for the rest of the years 𝐼 𝑘 

The minting curve affects the total rewards and the total returns through the parameters 𝑎(𝑡) 

and below, such that: 𝑏(𝑡) 

𝑎(𝑡) * 𝑇𝑜𝑡𝑎𝑙 𝑅𝑒𝑤𝑎𝑟𝑑𝑠 − 𝑏(𝑡) * 𝑇𝑜𝑡𝑎𝑙 𝑃𝑒𝑛𝑎𝑙𝑡𝑖𝑒𝑠 

This ensures the PLN tokens that are awarded do not exceed the token supply. 

# Issuance Curve 

The curve is defined as a piecewise linear function with three segments. The first segment 

has a higher slope to incentivize early adopters and to help bootstrap the protocol. Each 

segment is a linear function where a i is the designated slope for the year i: 

supply(t) = a it + b 

Current implementation allows selecting the parameters (a dn b) for the first 1400 days in 

periods of 365 days by the admin or governance with the sole restriction that there should 

not be more than 200M tokens before 1400 days. 

Given a particular boost on rewards, this implies a vertical shift in the actual supply. This is 

only for visualisation as different users will likely have different boost values depending on 

the amount of time that they lockup the tokens. 

> Figure 8. Expected supply curve of the PLN token, based on the usage of the protocol.

# Governance 

As we’ve discussed, PLN token holders inform the Pollen protocol by means of their virtual 

allocations in their virtual portfolios. Additionally, PLN token holders can lock their PLN 

tokens and create voter escrow PLN tokens or what we refer to as vePLN. Users that opt to 

lock their PLN tokens in return for vePLN tokens receive three benefits: 

1. Up to 20% boosted rewards on the performance of their virtual portfolios depending 

on the lock period 

2. A share from a pool equal to 10% of the total circulating supply as a reward for 

locking their PLN. 

3. Governance rights in which vePLN token holders can issue and vote on Pollen 

Improvement Proposals (PIPs) to improve the protocol 

Rewards and voting power are higher for longer locks, and they decay over the term of the 

lock, thereby incentivizing users to extend their lockup periods. Users have the option to 

relock their PLN in order to reset and again increase their boosted rewards and voting rights 

thereby offsetting the decay. In this way users express long-term confidence and support in 

the protocol and are rewarded for doing so. 

# Governance Architecture 

Let’s take a closer look at how this works in the contracts: 

1. When a Pollenator locks up their PLN to create a virtual portfolio, the protocol issues 

them vePLN tokens that they can use to govern the Pollen DAO. They can set the 

lockup period for any amount of time with a minimum of one week and a current 

maximum of 4 years. You can learn more about the issuance schedule in the Supply 

Control section of this lite paper. 

2. The longer a Pollenator’s lockup period the larger the boost to their reward issuance 

while still adhering to the supply limit curve 

3. The Pollenator’s vePLN tokens are non-transferable ERC-20s and represent the 

Pollenator’s voting rights. Voting rights and the boosted rewards decay over the 

period of the lock. I.e., users must continue to extend their lock-ups in order to 

maintain higher-levels of boosted rewards and increased voting power. Figure 9: Architecture of the Pollen DAO and Governance modules 

# Rewards 

Boosted rewards for Pollenators that lockup their PLN in return for vePLN, are calculated as 

a percentage increase to the rewards they’ve earned. These rewards are claimed when 

Pollenators rebalance or close their virtual portfolios. 

Further, the rate of the boost decays inline with the decay associated with voting rights over 

the term of the lockup. As more PLN tokens are locked, the rate of PLN rewards that will be 

issued decreases. 

Lastly, the protocol extends vePLN token holders to rewards similar to staking. That is, as 

new PLN is minted, vePLN token holders will get as a reward, a share from a pool of tokens 

equal to 10% of the total circulating supply. This way vePLN token holders get less diluted 

compared to others if the supply is inflationary and end up with an even bigger share if the 

supply is deflationary. Voting Rights 

The vePLN tokens empower Pollenators with voting rights. Rather than using the amount of 

tokens locked as voting power, the Pollen DAO assigns the voting power in relation to the 

amount of time that the user will be committed to the platform after voting for a proposal. 

That is, a user should be willing to confront the outcomes of the proposals for which they are 

voting. 

Voting power combines both the amount of PLN tokens locked and the remaining lockup 

duration for those tokens. This represents and directly models the level of commitment that 

users with voting rights have when it comes to governing the protocol. This idea stems from 

the Aragon Minime Token, later modified by the Curve team for their protocol: 

> Figure 10. The curve shows the voting power (w) decreasing linearly with time such that the less time
> left in a Pollenator’s lockup, the less voting power they have. Users have the option to extend lockup
> periods at any time to retain as much voting power as they can.

# Conclusion 

Our mission is to create new opportunities for trading communities to grow and establish a 

fully on-chain, decentralized prediction market. 

Pollen’s open protocol and merit-based system empower the community’s brightest minds, 

while our 2025 roadmap focuses on enhanced functionality, new feature sets and protocol 

upgrades with improved incentives, all aimed at delivering a seamless user experience 

across a comprehensive product suite. 

To achieve this, we’re launching a cross-chain product suite on Avalanche, Base, and 

Polygon networks, featuring: 

Pollen Virtual: A merit-based trading arena supporting long and short positions, rewarding 

contributors for accurate market predictions. Future improvements include expanded asset 

support and updated tokenomics to enhance user engagement. 

CryptoBowl: Adding a competitive edge to Pollen Virtual, CryptoBowl allows Leagues PRO 

organizations to participate in fully on-chain trading tournaments. Designed to drive 

community growth, CryptoBowl serves as an engine for expanding the Pollen community 

while offering multiple revenue opportunities for participating leagues. 

Pollen DAO: With a custom, self-executing protocol, Pollen DAO ensures that 

community-approved proposals are executed without centralized intervention. This 

decentralized governance model empowers members and ensures that the community 

remains in control. 

Prediction Market: Pollen is expanding its prediction market capabilities through protocol 

updates that streamline user experiences and enhance incentives for both new and 

experienced traders. An API will make prediction market data more accessible for users and 

external platforms alike. 

Pollen Leagues PRO: Leagues PRO offers tailored solutions for organizations, enabling 

them to host competitions with multiple revenue streams directly on Pollen. 

As Pollen expands cross-chain by leveraging a Layer-Zero cross-chain architecture, its 

evolving prediction market capabilities and an accessible API. This roadmap reflects Pollen’s 

commitment to democratizing DeFi, empowering its community, and setting new benchmarks 

for Web 3.0’s prediction market and asset trading landscape.
