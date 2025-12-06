CREATE TABLE [dbo].[Stocks] (

	[Date] date NULL, 
	[Open Price] decimal(19,4) NULL, 
	[High Price] decimal(19,4) NULL, 
	[Low Price] decimal(19,4) NULL, 
	[Close Price] decimal(19,4) NULL, 
	[WAP] float NULL, 
	[No.of Shares] bigint NULL, 
	[No. of Trades] bigint NULL, 
	[Total Turnover _Rs._] decimal(19,4) NULL, 
	[Deliverable Quantity] bigint NULL, 
	[% Deli. Qty to Traded Qty] float NULL, 
	[Spread High-Low] float NULL, 
	[Spread Close-Open] float NULL, 
	[Security Codes] bigint NULL
);